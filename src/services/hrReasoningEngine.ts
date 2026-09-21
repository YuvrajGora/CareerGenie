import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Employee, { IEmployee } from '@/models/Employee';
import EmployeeSignal, { IEmployeeSignal } from '@/models/EmployeeSignal';
import WorkforceRisk, { IWorkforceRisk, IRiskEvidence, IRiskAction } from '@/models/WorkforceRisk';
import { generateWorkforceRiskExplanation } from '@/services/gemini';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type RiskType = 'attrition' | 'burnout' | 'disengagement' | 'skill_stagnation';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface NormalizedSignalGroup {
  metric: string;
  type: string;
  latestValue: number;
  latestPeriod: string;
  previousValue?: number;
  previousPeriod?: string;
  benchmark?: number;
  deviationPct?: number;
  deltaPct?: number;
  allValues: Array<{ period: string; value: number; recordedAt: Date }>;
}

export interface NormalizedEmployeeTelemetry {
  employee: IEmployee;
  tenureMonths: number;
  signals: Map<string, NormalizedSignalGroup>;
  latestOvertimeHours: number;
  overtimeBaselineHours: number;
  latestPulseScore: number;
  pulseScoreTrend: number; // e.g. -4.7 drop
  pulseBaseline: number;
  latestOkrAchievement: number;
  okrTrend: number;
  okrBaseline: number;
  ptoDaysTakenYtd: number;
  ptoBaseline: number;
  quotaAttainment?: number;
}

export interface DeterministicRiskAssessment {
  riskType: RiskType;
  score: number; // Clamped 0-100
  severity: RiskSeverity;
  evidence: IRiskEvidence[];
  detected: boolean;
  contributingFactors: string[];
}

export interface WorkforceEvaluationSummary {
  evaluatedEmployees: number;
  risksDetected: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  timestamp: Date;
}

// ============================================================================
// DEPARTMENT ROLE COMPETENCY MATRIX (For deterministic skill stagnation detection)
// ============================================================================

export const DEPARTMENT_CORE_COMPETENCIES: Record<string, string[]> = {
  'Engineering': [
    'PostgreSQL',
    'Distributed Systems',
    'Kafka',
    'Docker',
    'Kubernetes',
    'Cloud / AWS',
    'CI/CD Pipelines',
    'TypeScript',
    'System Architecture'
  ],
  'Product & Design': [
    'User Research',
    'Figma',
    'Design Systems',
    'Product Discovery',
    'Agile Roadmapping',
    'Prototyping',
    'UX Analytics'
  ],
  'Sales & Marketing': [
    'Enterprise Sales',
    'Contract Negotiation',
    'CRM Pipeline Management',
    'Paid Acquisition',
    'GTM Strategy',
    'B2B Outbound'
  ],
  'Operations & HR': [
    'Talent Analytics',
    'HRIS Management',
    'Employment Law',
    'Performance Management',
    'Compensation Modeling'
  ],
  'Finance': [
    'Financial Modeling',
    'SaaS Metrics & Forecasting',
    'GAAP Accounting',
    'Audit & Compliance'
  ]
};

// ============================================================================
// SEVERITY THRESHOLD MAPPING (0 - 100)
// ============================================================================

export function mapScoreToSeverity(score: number): RiskSeverity {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 75) return 'critical';
  if (clamped >= 50) return 'high';
  if (clamped >= 25) return 'medium';
  return 'low';
}

// ============================================================================
// 1. SIGNAL NORMALIZATION
// ============================================================================

export function normalizeEmployeeSignals(
  employee: IEmployee,
  rawSignals: IEmployeeSignal[]
): NormalizedEmployeeTelemetry {
  const signalMap = new Map<string, NormalizedSignalGroup>();

  // Group signals by metric
  for (const signal of rawSignals) {
    const existing = signalMap.get(signal.metric);
    if (!existing) {
      signalMap.set(signal.metric, {
        metric: signal.metric,
        type: signal.type,
        latestValue: signal.value,
        latestPeriod: signal.period,
        benchmark: signal.benchmark,
        deviationPct: signal.deviationPct,
        allValues: [{ period: signal.period, value: signal.value, recordedAt: signal.recordedAt }]
      });
    } else {
      existing.allValues.push({
        period: signal.period,
        value: signal.value,
        recordedAt: signal.recordedAt
      });
    }
  }

  // Sort chronological for each metric
  for (const [, group] of signalMap.entries()) {
    group.allValues.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const len = group.allValues.length;
    if (len > 0) {
      group.latestValue = group.allValues[len - 1].value;
      group.latestPeriod = group.allValues[len - 1].period;
      if (len > 1) {
        group.previousValue = group.allValues[len - 2].value;
        group.previousPeriod = group.allValues[len - 2].period;
        if (group.previousValue !== 0) {
          group.deltaPct = ((group.latestValue - group.previousValue) / group.previousValue) * 100;
        }
      }
    }
  }

  // Compute employee tenure in months
  const now = new Date();
  const join = new Date(employee.joiningDate);
  const tenureMonths = Math.max(
    0,
    (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
  );

  // Extract key normalized telemetry
  const overtimeGroup = signalMap.get('weekly_overtime_hours');
  const pulseGroup = signalMap.get('pulse_survey_score');
  const okrGroup = signalMap.get('okr_achievement_pct');
  const quotaGroup = signalMap.get('quota_attainment_pct');
  const ptoGroup = signalMap.get('pto_days_taken_ytd');

  // Pulse trend: total drop from first to latest or previous to latest
  let pulseTrend = 0;
  if (pulseGroup && pulseGroup.allValues.length > 1) {
    const first = pulseGroup.allValues[0].value;
    const latest = pulseGroup.latestValue;
    pulseTrend = latest - first; // Negative indicates drop
  }

  // OKR trend
  let okrTrend = 0;
  if (okrGroup && okrGroup.allValues.length > 1) {
    const first = okrGroup.allValues[0].value;
    const latest = okrGroup.latestValue;
    okrTrend = latest - first;
  }

  return {
    employee,
    tenureMonths,
    signals: signalMap,
    latestOvertimeHours: overtimeGroup ? overtimeGroup.latestValue : 0,
    overtimeBaselineHours: overtimeGroup?.benchmark ?? 3.5,
    latestPulseScore: pulseGroup ? pulseGroup.latestValue : 7.5,
    pulseScoreTrend: pulseTrend,
    pulseBaseline: pulseGroup?.benchmark ?? 7.5,
    latestOkrAchievement: okrGroup ? okrGroup.latestValue : 85,
    okrTrend,
    okrBaseline: okrGroup?.benchmark ?? 85,
    ptoDaysTakenYtd: ptoGroup ? ptoGroup.latestValue : 5,
    ptoBaseline: ptoGroup?.benchmark ?? 6,
    quotaAttainment: quotaGroup ? quotaGroup.latestValue : undefined
  };
}

// ============================================================================
// 2. DETERMINISTIC CROSS-SIGNAL EVALUATORS
// ============================================================================

/**
 * A. BURNOUT EVALUATION
 * Detects combinations such as:
 * - significantly elevated overtime (>8 hrs, >15 hrs)
 * - declining engagement / pulse survey score (<5.0, negative trend)
 * - declining OKR / performance (<75%, negative drop)
 * - unusually low PTO usage (0 or minimal days YTD with 100% negative deviation)
 * Includes multi-signal compounding factor.
 */
export function calculateBurnoutRisk(
  telemetry: NormalizedEmployeeTelemetry
): DeterministicRiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const evidence: IRiskEvidence[] = [];

  const {
    latestOvertimeHours,
    overtimeBaselineHours,
    latestPulseScore,
    pulseScoreTrend,
    pulseBaseline,
    latestOkrAchievement,
    okrTrend,
    okrBaseline,
    ptoDaysTakenYtd,
    ptoBaseline
  } = telemetry;

  // 1. Overtime hours evaluation
  if (latestOvertimeHours >= 15) {
    score += 35;
    factors.push(`Severe sustained overtime (${latestOvertimeHours} hrs/wk vs ${overtimeBaselineHours} hrs baseline)`);
    evidence.push({
      signalType: 'workload',
      metric: 'weekly_overtime_hours',
      observedValue: `${latestOvertimeHours} hrs/week`,
      benchmark: `${overtimeBaselineHours} hrs/week`,
      significance: 'high'
    });
  } else if (latestOvertimeHours >= 8) {
    score += 20;
    factors.push(`Elevated overtime (${latestOvertimeHours} hrs/wk vs ${overtimeBaselineHours} hrs baseline)`);
    evidence.push({
      signalType: 'workload',
      metric: 'weekly_overtime_hours',
      observedValue: `${latestOvertimeHours} hrs/week`,
      benchmark: `${overtimeBaselineHours} hrs/week`,
      significance: 'medium'
    });
  }

  // Overtime deviation check
  if (overtimeBaselineHours > 0) {
    const overtimeDeviationPct = ((latestOvertimeHours - overtimeBaselineHours) / overtimeBaselineHours) * 100;
    if (overtimeDeviationPct >= 300) {
      score += 15;
      factors.push(`Workload exceeds benchmark by +${Math.round(overtimeDeviationPct)}%`);
    } else if (overtimeDeviationPct >= 100) {
      score += 10;
      factors.push(`Workload exceeds benchmark by +${Math.round(overtimeDeviationPct)}%`);
    }
  }

  // 2. Engagement / Pulse Score
  if (latestPulseScore < 4.5) {
    score += 25;
    factors.push(`Critically depressed pulse survey rating (${latestPulseScore}/10 vs ${pulseBaseline} baseline)`);
    evidence.push({
      signalType: 'engagement',
      metric: 'pulse_survey_score',
      observedValue: `${latestPulseScore} / 10`,
      benchmark: `${pulseBaseline} / 10`,
      significance: 'high'
    });
  } else if (latestPulseScore < 6.0) {
    score += 15;
    factors.push(`Declining employee pulse satisfaction (${latestPulseScore}/10 vs ${pulseBaseline} baseline)`);
    evidence.push({
      signalType: 'engagement',
      metric: 'pulse_survey_score',
      observedValue: `${latestPulseScore} / 10`,
      benchmark: `${pulseBaseline} / 10`,
      significance: 'medium'
    });
  }

  // Pulse trend decline
  if (pulseScoreTrend <= -2.0) {
    score += 20;
    factors.push(`Sharp longitudinal engagement drop (${pulseScoreTrend.toFixed(1)} points over recent quarters)`);
  } else if (pulseScoreTrend <= -1.0) {
    score += 10;
    factors.push(`Steady downward engagement drift (${pulseScoreTrend.toFixed(1)} points)`);
  }

  // 3. Performance / OKR achievement decline
  if (latestOkrAchievement < 75) {
    score += 15;
    factors.push(`Sub-target OKR achievement (${latestOkrAchievement}% vs ${okrBaseline}% target)`);
    evidence.push({
      signalType: 'performance',
      metric: 'okr_achievement_pct',
      observedValue: `${latestOkrAchievement}%`,
      benchmark: `${okrBaseline}%`,
      significance: 'medium'
    });
  }
  if (okrTrend <= -15) {
    score += 15;
    factors.push(`Performance decline velocity of ${Math.abs(Math.round(okrTrend))}% across quarterly cycles`);
  }

  // 4. PTO usage anomaly
  if (ptoDaysTakenYtd === 0 && ptoBaseline > 0) {
    score += 15;
    factors.push(`Zero PTO days utilized YTD (${ptoBaseline} days expected benchmark)`);
    evidence.push({
      signalType: 'attendance',
      metric: 'pto_days_taken_ytd',
      observedValue: '0 days taken',
      benchmark: `${ptoBaseline} days expected`,
      significance: 'medium'
    });
  }

  // 5. Cross-signal synergistic boost: Overtime + Low Pulse
  if (latestOvertimeHours >= 8 && latestPulseScore < 6.0) {
    score += 10;
    factors.push('Compounding risk: High overtime pressure coincides with collapsing engagement');
  }

  // Clamp 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const severity = mapScoreToSeverity(finalScore);

  return {
    riskType: 'burnout',
    score: finalScore,
    severity,
    evidence,
    detected: finalScore >= 25,
    contributingFactors: factors
  };
}

/**
 * B. ATTRITION / FLIGHT RISK EVALUATION
 * Detects combinations such as:
 * - low/declining engagement
 * - sustained workload pressure
 * - high market demand / strong performers without progression
 * - low PTO / burnout trajectory
 * - recorded flightRiskLevel
 */
export function calculateAttritionRisk(
  telemetry: NormalizedEmployeeTelemetry
): DeterministicRiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const evidence: IRiskEvidence[] = [];

  const {
    employee,
    tenureMonths,
    latestPulseScore,
    pulseScoreTrend,
    pulseBaseline,
    latestOvertimeHours,
    overtimeBaselineHours,
    ptoDaysTakenYtd,
    latestOkrAchievement,
    quotaAttainment
  } = telemetry;

  // 1. Engagement & Sentiment
  if (latestPulseScore < 4.5) {
    score += 30;
    factors.push(`Severe flight sentiment: Pulse rating at ${latestPulseScore}/10 indicates high departure probability`);
    evidence.push({
      signalType: 'engagement',
      metric: 'pulse_survey_score',
      observedValue: `${latestPulseScore} / 10`,
      benchmark: `${pulseBaseline} / 10`,
      significance: 'high'
    });
  } else if (latestPulseScore < 6.0) {
    score += 15;
    factors.push(`Moderate flight sentiment: Pulse rating at ${latestPulseScore}/10`);
    evidence.push({
      signalType: 'engagement',
      metric: 'pulse_survey_score',
      observedValue: `${latestPulseScore} / 10`,
      benchmark: `${pulseBaseline} / 10`,
      significance: 'medium'
    });
  }

  if (pulseScoreTrend <= -2.0) {
    score += 15;
    factors.push(`Rapidly worsening morale trajectory (${pulseScoreTrend.toFixed(1)} drop)`);
  }

  // 2. High performer market vulnerability (High performance + unreviewed/prolonged tenure)
  const isHighPerformer =
    employee.performanceRating >= 4.5 ||
    (quotaAttainment && quotaAttainment >= 110) ||
    latestOkrAchievement >= 90;

  if (isHighPerformer) {
    if (tenureMonths >= 18) {
      score += 20;
      factors.push(`High performer retention vulnerability: Rating ${employee.performanceRating} with ${tenureMonths} months tenure`);
      evidence.push({
        signalType: 'tenure',
        metric: 'tenure_without_progression',
        observedValue: `${tenureMonths} months tenure`,
        benchmark: '12-18 months standard cycle',
        significance: 'high'
      });
    } else {
      score += 10;
      factors.push(`Top-tier performer with high external market demand (Rating ${employee.performanceRating})`);
    }
  }

  // 3. Workload pressure / burnout-induced departure
  if (latestOvertimeHours >= 12) {
    score += 20;
    factors.push(`Exhaustion-driven attrition risk: ${latestOvertimeHours} weekly overtime hours`);
    evidence.push({
      signalType: 'workload',
      metric: 'weekly_overtime_hours',
      observedValue: `${latestOvertimeHours} hrs/week`,
      benchmark: `${overtimeBaselineHours} hrs/week`,
      significance: 'medium'
    });
  }

  // 4. Zero PTO in extended tenure
  if (ptoDaysTakenYtd === 0 && tenureMonths >= 6) {
    score += 15;
    factors.push('Disconnection warning: Zero vacation days taken despite sustained service');
    evidence.push({
      signalType: 'attendance',
      metric: 'pto_days_taken_ytd',
      observedValue: '0 days taken',
      benchmark: '6-8 days target',
      significance: 'medium'
    });
  }

  // 5. Existing flight risk indicator
  if (employee.flightRiskLevel === 'critical') {
    score += 20;
    factors.push('HR manager flag: Critical flight risk previously flagged');
  } else if (employee.flightRiskLevel === 'high') {
    score += 15;
    factors.push('HR manager flag: High flight risk indicator present on profile');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const severity = mapScoreToSeverity(finalScore);

  return {
    riskType: 'attrition',
    score: finalScore,
    severity,
    evidence,
    detected: finalScore >= 25,
    contributingFactors: factors
  };
}

/**
 * C. DISENGAGEMENT EVALUATION
 * Detects combinations such as:
 * - low or dropping pulse survey score
 * - attendance anomalies or 0 PTO
 * - performance deterioration
 */
export function calculateDisengagementRisk(
  telemetry: NormalizedEmployeeTelemetry
): DeterministicRiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const evidence: IRiskEvidence[] = [];

  const {
    latestPulseScore,
    pulseScoreTrend,
    pulseBaseline,
    latestOkrAchievement,
    okrTrend,
    okrBaseline,
    ptoDaysTakenYtd,
    ptoBaseline
  } = telemetry;

  // 1. Engagement pulse level
  if (latestPulseScore < 5.0) {
    score += 35;
    factors.push(`Disengaged sentiment: Pulse score ${latestPulseScore}/10 is far below ${pulseBaseline} baseline`);
    evidence.push({
      signalType: 'engagement',
      metric: 'pulse_survey_score',
      observedValue: `${latestPulseScore} / 10`,
      benchmark: `${pulseBaseline} / 10`,
      significance: 'high'
    });
  } else if (latestPulseScore < 6.5) {
    score += 20;
    factors.push(`Sub-optimal engagement: Pulse score ${latestPulseScore}/10`);
    evidence.push({
      signalType: 'engagement',
      metric: 'pulse_survey_score',
      observedValue: `${latestPulseScore} / 10`,
      benchmark: `${pulseBaseline} / 10`,
      significance: 'medium'
    });
  }

  // 2. Pulse trend
  if (pulseScoreTrend <= -2.0) {
    score += 20;
    factors.push(`Longitudinal drop of ${pulseScoreTrend.toFixed(1)} points across survey intervals`);
  }

  // 3. Performance / Output deceleration
  if (latestOkrAchievement < 75) {
    score += 25;
    factors.push(`Slumping execution: OKR progress at ${latestOkrAchievement}% vs ${okrBaseline}% target`);
    evidence.push({
      signalType: 'performance',
      metric: 'okr_achievement_pct',
      observedValue: `${latestOkrAchievement}%`,
      benchmark: `${okrBaseline}%`,
      significance: 'medium'
    });
  }
  if (okrTrend <= -15) {
    score += 15;
    factors.push(`Negative performance momentum: ${Math.round(okrTrend)}% quarterly drop`);
  }

  // 4. Attendance anomaly / unutilized PTO
  if (ptoDaysTakenYtd === 0 && ptoBaseline > 0) {
    score += 15;
    factors.push(`Attendance anomaly: 0 PTO days recorded YTD indicates possible disengagement or absence from team rhythms`);
    evidence.push({
      signalType: 'attendance',
      metric: 'pto_days_taken_ytd',
      observedValue: '0 days taken',
      benchmark: `${ptoBaseline} days expected`,
      significance: 'low'
    });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const severity = mapScoreToSeverity(finalScore);

  return {
    riskType: 'disengagement',
    score: finalScore,
    severity,
    evidence,
    detected: finalScore >= 25,
    contributingFactors: factors
  };
}

/**
 * D. SKILL STAGNATION / SKILL GAP EVALUATION
 * Detects combinations such as:
 * - missing critical competencies required for role & department
 * - long tenure (>18 months) without verified skill progression
 * - unverified skill sets for Senior+ employees
 */
export function calculateSkillStagnationRisk(
  telemetry: NormalizedEmployeeTelemetry
): DeterministicRiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const evidence: IRiskEvidence[] = [];

  const { employee, tenureMonths } = telemetry;
  const deptCompetencies = DEPARTMENT_CORE_COMPETENCIES[employee.department] || [];
  const employeeSkillNames = new Set((employee.skills || []).map((s) => s.name.toLowerCase()));

  // Identify missing department core competencies
  const missingCoreCompetencies = deptCompetencies.filter(
    (comp) => !employeeSkillNames.has(comp.toLowerCase())
  );

  // Missing competencies weight (especially for Senior/Lead/Staff)
  const isSeniorPlus = ['Senior', 'Lead', 'Staff', 'Director'].includes(employee.level);

  if (missingCoreCompetencies.length >= 4) {
    score += isSeniorPlus ? 40 : 25;
    factors.push(`Substantial competency deficit: Missing ${missingCoreCompetencies.length} core ${employee.department} skills`);
    evidence.push({
      signalType: 'skill_gap',
      metric: 'missing_department_competencies',
      observedValue: `Missing ${missingCoreCompetencies.slice(0, 3).join(', ')}...`,
      benchmark: `${deptCompetencies.length} standard departmental skills`,
      significance: 'high'
    });
  } else if (missingCoreCompetencies.length >= 2) {
    score += isSeniorPlus ? 30 : 15;
    factors.push(`Identified skill gaps: Missing ${missingCoreCompetencies.slice(0, 2).join(', ')}`);
    evidence.push({
      signalType: 'skill_gap',
      metric: 'missing_department_competencies',
      observedValue: `Missing ${missingCoreCompetencies.slice(0, 2).join(', ')}`,
      benchmark: `${deptCompetencies.length} standard departmental skills`,
      significance: 'medium'
    });
  }

  // Ratio of verified skills
  const verifiedCount = (employee.skills || []).filter((s) => s.verified).length;

  // Tenure without skill verification / progression
  if (missingCoreCompetencies.length > 0 || verifiedCount < 3) {
    if (tenureMonths >= 20) {
      score += 25;
      factors.push(`Extended tenure stagnation: ${tenureMonths} months without new verified technical competencies`);
      evidence.push({
        signalType: 'tenure',
        metric: 'tenure_months',
        observedValue: `${tenureMonths} months tenure`,
        benchmark: '12-18 months recertification window',
        significance: 'medium'
      });
    } else if (tenureMonths >= 14) {
      score += 15;
      factors.push(`Approaching stagnation threshold: ${tenureMonths} months tenure`);
    }
  }

  if (isSeniorPlus && verifiedCount < 3) {
    score += 20;
    factors.push(`Unverified senior skill profile: Only ${verifiedCount} verified competencies`);
    evidence.push({
      signalType: 'skill_gap',
      metric: 'verified_skills_count',
      observedValue: `${verifiedCount} verified skills`,
      benchmark: 'Minimum 4 verified skills for Senior level',
      significance: 'medium'
    });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const severity = mapScoreToSeverity(finalScore);

  return {
    riskType: 'skill_stagnation',
    score: finalScore,
    severity,
    evidence,
    detected: finalScore >= 25,
    contributingFactors: factors
  };
}

// ============================================================================
// 3. COMBINED EVALUATION FOR A SINGLE EMPLOYEE
// ============================================================================

export function calculateRiskSignals(
  telemetry: NormalizedEmployeeTelemetry
): DeterministicRiskAssessment[] {
  return [
    calculateBurnoutRisk(telemetry),
    calculateAttritionRisk(telemetry),
    calculateDisengagementRisk(telemetry),
    calculateSkillStagnationRisk(telemetry)
  ];
}

/**
 * Evaluates an employee across all 4 risk categories.
 * Deterministically computes scores, generates empirical evidence,
 * calls Gemini (or deterministic fallback) for human explanation,
 * and upserts WorkforceRisk records into MongoDB without duplicates.
 */
export async function evaluateEmployeeRisk(
  employeeId: string | mongoose.Types.ObjectId,
  options: { skipGemini?: boolean } = {}
): Promise<IWorkforceRisk[]> {
  await connectDB();

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new Error(`Employee with ID ${employeeId} not found`);
  }

  // Fetch all signals for this employee
  const rawSignals = await EmployeeSignal.find({ employeeId: employee._id });

  // 1. Normalize
  const telemetry = normalizeEmployeeSignals(employee, rawSignals);

  // 2. Deterministic risk detection
  const assessments = calculateRiskSignals(telemetry);

  const results: IWorkforceRisk[] = [];

  for (const assessment of assessments) {
    // If risk is detected (score >= 25), upsert active risk
    if (assessment.detected) {
      // 3. Explain findings via Gemini or deterministic fallback
      let explanationPayload: {
        whatHappened: string;
        whyItMatters: string;
        aiExplanation: string;
        recommendedActions: IRiskAction[];
      };

      if (options.skipGemini) {
        // Fallback explanation directly without API call
        explanationPayload = {
          whatHappened: `${assessment.severity.toUpperCase()} ${assessment.riskType} risk detected for ${employee.name} (${employee.roleTitle}, ${employee.department}).`,
          whyItMatters: `Telemetry indicates significant organizational risk across ${assessment.contributingFactors.length} factors.`,
          aiExplanation: `Deterministic multi-signal correlation detected ${assessment.riskType} risk (score: ${assessment.score}/100, severity: ${assessment.severity}). Factors: ${assessment.contributingFactors.join('; ')}.`,
          recommendedActions: [
            {
              actionId: `ACT-${assessment.riskType.toUpperCase().slice(0, 2)}-01`,
              title: `Address ${assessment.riskType} telemetry`,
              rationale: `Proactive intervention to resolve: ${assessment.contributingFactors[0] || 'observed metrics'}.`,
              urgency: assessment.severity === 'critical' ? 'immediate' : 'short_term',
              status: 'pending'
            }
          ]
        };
      } else {
        explanationPayload = await generateWorkforceRiskExplanation(
          {
            name: employee.name,
            roleTitle: employee.roleTitle,
            department: employee.department,
            level: employee.level
          },
          assessment.riskType,
          assessment.severity,
          assessment.score,
          assessment.evidence
        );
      }

      // 4. Upsert WorkforceRisk record (Unique by employeeId + riskType)
      const updatedRisk = await WorkforceRisk.findOneAndUpdate(
        { employeeId: employee._id, riskType: assessment.riskType },
        {
          employeeId: employee._id,
          riskType: assessment.riskType,
          severity: assessment.severity,
          score: assessment.score,
          evidence: assessment.evidence,
          whatHappened: explanationPayload.whatHappened,
          whyItMatters: explanationPayload.whyItMatters,
          aiExplanation: explanationPayload.aiExplanation,
          recommendedActions: explanationPayload.recommendedActions,
          status: 'active',
          evaluatedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      results.push(updatedRisk);
    } else {
      // If score is < 25 (healthy/low risk), mark any existing active risk as mitigated
      await WorkforceRisk.updateMany(
        { employeeId: employee._id, riskType: assessment.riskType, status: 'active' },
        {
          $set: {
            status: 'mitigated',
            score: assessment.score,
            severity: 'low',
            evaluatedAt: new Date()
          }
        }
      );
    }
  }

  return results;
}

// ============================================================================
// 4. WORKFORCE-WIDE EVALUATION
// ============================================================================

export async function evaluateWorkforceRisks(
  filter: Partial<{ department: string; status: string; employeeCode: string }> = {},
  options: { skipGemini?: boolean } = {}
): Promise<WorkforceEvaluationSummary> {
  await connectDB();

  const query: Record<string, any> = {
    status: filter.status || 'active'
  };
  if (filter.department) query.department = filter.department;
  if (filter.employeeCode) query.employeeCode = filter.employeeCode;

  const employees = await Employee.find(query);

  let totalRisksDetected = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const employee of employees) {
    const risks = await evaluateEmployeeRisk(employee._id, options);
    for (const r of risks) {
      if (r.status === 'active') {
        totalRisksDetected++;
        if (r.severity === 'critical') criticalCount++;
        else if (r.severity === 'high') highCount++;
        else if (r.severity === 'medium') mediumCount++;
        else if (r.severity === 'low') lowCount++;
      }
    }
  }

  return {
    evaluatedEmployees: employees.length,
    risksDetected: totalRisksDetected,
    critical: criticalCount,
    high: highCount,
    medium: mediumCount,
    low: lowCount,
    timestamp: new Date()
  };
}
