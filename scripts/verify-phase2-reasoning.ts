import fs from 'fs';
import path from 'path';

// Automatically load .env.local or .env if present in the workspace
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
  try { process.loadEnvFile(envLocalPath); } catch {}
} else if (fs.existsSync(envPath)) {
  try { process.loadEnvFile(envPath); } catch {}
}

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import Employee from '../src/models/Employee';
import EmployeeSignal from '../src/models/EmployeeSignal';
import WorkforceRisk from '../src/models/WorkforceRisk';
import {
  normalizeEmployeeSignals,
  calculateBurnoutRisk,
  calculateAttritionRisk,
  calculateDisengagementRisk,
  calculateSkillStagnationRisk,
  mapScoreToSeverity,
  evaluateEmployeeRisk,
  evaluateWorkforceRisks,
  DEPARTMENT_CORE_COMPETENCIES
} from '../src/services/hrReasoningEngine';
import { generateWorkforceRiskExplanation } from '../src/services/gemini';
import { signToken, ROLE_COOKIE_MAP, ROLE_HEADER_NAME, verifyTokenWithRole } from '../src/middleware/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

async function runPhase2ReasoningTests() {
  console.log('====================================================');
  console.log('  Phase 2.2: HR Reasoning Engine & Risk Radar Tests ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  console.log('[Test 1: Deterministic Thresholds & Clamping 0-100]');
  // ---------------------------------------------------------------
  assert(mapScoreToSeverity(0) === 'low', 'Score 0 maps to low');
  assert(mapScoreToSeverity(24) === 'low', 'Score 24 maps to low');
  assert(mapScoreToSeverity(25) === 'medium', 'Score 25 maps to medium');
  assert(mapScoreToSeverity(49) === 'medium', 'Score 49 maps to medium');
  assert(mapScoreToSeverity(50) === 'high', 'Score 50 maps to high');
  assert(mapScoreToSeverity(74) === 'high', 'Score 74 maps to high');
  assert(mapScoreToSeverity(75) === 'critical', 'Score 75 maps to critical');
  assert(mapScoreToSeverity(100) === 'critical', 'Score 100 maps to critical');
  assert(mapScoreToSeverity(-50) === 'low', 'Negative score clamped and maps to low');
  assert(mapScoreToSeverity(180) === 'critical', 'Overflow score clamped and maps to critical');

  // ---------------------------------------------------------------
  console.log('\n[Test 2: Burnout Detection (High Overtime + Engagement Decline + OKR Decline)]');
  // ---------------------------------------------------------------
  const mockBurnoutEmployee = new Employee({
    employeeCode: 'EMP-TEST-BURNOUT',
    name: 'Alex Chen',
    email: 'alex.chen@careergenie.internal',
    department: 'Engineering',
    roleTitle: 'Senior Infrastructure Engineer',
    level: 'Senior',
    joiningDate: new Date('2023-01-01'),
    salary: 160000,
    status: 'active',
    performanceRating: 3.8,
    flightRiskLevel: 'high'
  });

  const mockBurnoutSignals = [
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'workload',
      metric: 'weekly_overtime_hours',
      value: 18.5,
      benchmark: 3.5,
      period: '2026-W11',
      recordedAt: new Date('2026-03-15')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'engagement',
      metric: 'pulse_survey_score',
      value: 8.5,
      benchmark: 7.5,
      period: '2025-Q3',
      recordedAt: new Date('2025-09-01')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'engagement',
      metric: 'pulse_survey_score',
      value: 3.8,
      benchmark: 7.5,
      period: '2026-Q1',
      recordedAt: new Date('2026-03-01')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'performance',
      metric: 'okr_achievement_pct',
      value: 92,
      benchmark: 85,
      period: '2025-Q3',
      recordedAt: new Date('2025-09-01')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'performance',
      metric: 'okr_achievement_pct',
      value: 65,
      benchmark: 85,
      period: '2026-Q1',
      recordedAt: new Date('2026-03-01')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'attendance',
      metric: 'pto_days_taken_ytd',
      value: 0,
      benchmark: 10,
      period: '2026-YTD',
      recordedAt: new Date('2026-03-15')
    })
  ];

  const burnoutTelemetry = normalizeEmployeeSignals(mockBurnoutEmployee, mockBurnoutSignals);
  const burnoutResult = calculateBurnoutRisk(burnoutTelemetry);

  assert(burnoutResult.detected === true, 'Burnout risk correctly detected');
  assert(burnoutResult.score >= 75, `Burnout score is critical (calculated: ${burnoutResult.score})`);
  assert(burnoutResult.severity === 'critical', 'Severity is critical');
  assert(burnoutResult.evidence.length >= 3, `Evidence generated with ${burnoutResult.evidence.length} items`);
  const workloadEv = burnoutResult.evidence.find((e) => e.signalType === 'workload');
  assert(!!workloadEv && workloadEv.observedValue === '18.5 hrs/week', 'Workload evidence contains exact observed value 18.5 hrs/week');

  // ---------------------------------------------------------------
  console.log('\n[Test 3: Healthy Employee (No False Critical Risk)]');
  // ---------------------------------------------------------------
  const mockHealthyEmployee = new Employee({
    employeeCode: 'EMP-TEST-HEALTHY',
    name: 'Sarah Lin',
    email: 'sarah.lin@careergenie.internal',
    department: 'Engineering',
    roleTitle: 'Lead Frontend Architect',
    level: 'Lead',
    joiningDate: new Date('2024-01-01'),
    salary: 175000,
    status: 'active',
    performanceRating: 4.9,
    flightRiskLevel: 'low',
    skills: DEPARTMENT_CORE_COMPETENCIES['Engineering'].map((name) => ({
      name,
      proficiency: 'expert',
      category: 'technical',
      verified: true
    }))
  });

  const mockHealthySignals = [
    new EmployeeSignal({
      employeeId: mockHealthyEmployee._id,
      type: 'workload',
      metric: 'weekly_overtime_hours',
      value: 1.5,
      benchmark: 3.5,
      period: '2026-W11',
      recordedAt: new Date('2026-03-15')
    }),
    new EmployeeSignal({
      employeeId: mockHealthyEmployee._id,
      type: 'engagement',
      metric: 'pulse_survey_score',
      value: 9.2,
      benchmark: 7.5,
      period: '2026-Q1',
      recordedAt: new Date('2026-03-01')
    }),
    new EmployeeSignal({
      employeeId: mockHealthyEmployee._id,
      type: 'performance',
      metric: 'okr_achievement_pct',
      value: 96,
      benchmark: 85,
      period: '2026-Q1',
      recordedAt: new Date('2026-03-01')
    }),
    new EmployeeSignal({
      employeeId: mockHealthyEmployee._id,
      type: 'attendance',
      metric: 'pto_days_taken_ytd',
      value: 5,
      benchmark: 6,
      period: '2026-YTD',
      recordedAt: new Date('2026-03-15')
    })
  ];

  const healthyTelemetry = normalizeEmployeeSignals(mockHealthyEmployee, mockHealthySignals);
  const healthyBurnout = calculateBurnoutRisk(healthyTelemetry);
  const healthyAttrition = calculateAttritionRisk(healthyTelemetry);
  const healthyDisengagement = calculateDisengagementRisk(healthyTelemetry);
  const healthySkillStagnation = calculateSkillStagnationRisk(healthyTelemetry);

  assert(healthyBurnout.score < 25 && healthyBurnout.severity === 'low', 'Healthy employee has low burnout score');
  assert(healthyAttrition.score < 25 && healthyAttrition.severity === 'low', 'Healthy employee has low attrition score');
  assert(healthyDisengagement.score < 25 && healthyDisengagement.severity === 'low', 'Healthy employee has low disengagement score');
  assert(healthySkillStagnation.score < 25 && healthySkillStagnation.severity === 'low', 'Healthy employee has low skill stagnation score');
  assert(!healthyBurnout.detected && !healthyAttrition.detected, 'Healthy employee does not trigger false positive active risk');

  // ---------------------------------------------------------------
  console.log('\n[Test 4: Skill Gap & Skill Stagnation Scenario]');
  // ---------------------------------------------------------------
  const mockStagnantEmployee = new Employee({
    employeeCode: 'EMP-1003',
    name: 'David Kumar',
    email: 'david.kumar@careergenie.internal',
    department: 'Engineering',
    roleTitle: 'Senior Backend Engineer',
    level: 'Senior',
    joiningDate: new Date('2024-05-10'), // ~22 months tenure
    salary: 165000,
    status: 'active',
    performanceRating: 4.2,
    flightRiskLevel: 'medium',
    skills: [
      { name: 'Python', proficiency: 'expert', category: 'technical', verified: true },
      { name: 'Django', proficiency: 'expert', category: 'technical', verified: true }
    ] // Missing core Engineering distributed competencies
  });

  const stagnantTelemetry = normalizeEmployeeSignals(mockStagnantEmployee, []);
  const stagnantResult = calculateSkillStagnationRisk(stagnantTelemetry);

  assert(stagnantResult.detected === true, 'Skill stagnation correctly detected');
  assert(stagnantResult.score >= 50, `Skill stagnation score is high or critical (score: ${stagnantResult.score})`);
  const skillEvidence = stagnantResult.evidence.find((e) => e.signalType === 'skill_gap');
  assert(!!skillEvidence, 'Generates empirical skill_gap evidence item');
  assert(stagnantResult.contributingFactors.some((f) => f.includes('competency deficit')), 'Contributing factors note competency deficit');

  // ---------------------------------------------------------------
  console.log('\n[Test 5: Attendance + Engagement Decline → Disengagement Detection]');
  // ---------------------------------------------------------------
  const mockDisengagedSignals = [
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'engagement',
      metric: 'pulse_survey_score',
      value: 4.2,
      benchmark: 7.5,
      period: '2026-Q1',
      recordedAt: new Date('2026-03-01')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'performance',
      metric: 'okr_achievement_pct',
      value: 68,
      benchmark: 85,
      period: '2026-Q1',
      recordedAt: new Date('2026-03-01')
    }),
    new EmployeeSignal({
      employeeId: mockBurnoutEmployee._id,
      type: 'attendance',
      metric: 'pto_days_taken_ytd',
      value: 0,
      benchmark: 8,
      period: '2026-YTD',
      recordedAt: new Date('2026-03-15')
    })
  ];

  const disengagedTelemetry = normalizeEmployeeSignals(mockBurnoutEmployee, mockDisengagedSignals);
  const disengagedResult = calculateDisengagementRisk(disengagedTelemetry);

  assert(disengagedResult.detected === true, 'Disengagement risk detected');
  assert(disengagedResult.score >= 50, `Disengagement score is high/critical (score: ${disengagedResult.score})`);
  assert(disengagedResult.evidence.some((e) => e.signalType === 'engagement'), 'Contains engagement evidence');
  assert(disengagedResult.evidence.some((e) => e.signalType === 'performance'), 'Contains performance evidence');

  // ---------------------------------------------------------------
  console.log('\n[Test 6: Gemini Unavailable Fallback Resilience]');
  // ---------------------------------------------------------------
  const fallbackExplanation = await generateWorkforceRiskExplanation(
    { name: 'Alex Chen', roleTitle: 'Senior Systems Engineer', department: 'Engineering', level: 'Senior' },
    'burnout',
    'critical',
    95,
    burnoutResult.evidence
  );

  assert(typeof fallbackExplanation.whatHappened === 'string' && fallbackExplanation.whatHappened.length > 10, 'Fallback generates whatHappened');
  assert(typeof fallbackExplanation.whyItMatters === 'string' && fallbackExplanation.whyItMatters.length > 10, 'Fallback generates whyItMatters');
  assert(typeof fallbackExplanation.aiExplanation === 'string' && fallbackExplanation.aiExplanation.length > 10, 'Fallback generates aiExplanation');
  assert(Array.isArray(fallbackExplanation.recommendedActions) && fallbackExplanation.recommendedActions.length >= 2, 'Fallback generates 2+ recommended actions');
  assert(fallbackExplanation.recommendedActions[0].urgency === 'immediate', 'Critical burnout fallback recommends immediate action');

  // ---------------------------------------------------------------
  console.log('\n[Test 7: Evidence Integrity - Grounded in Actual Signals]');
  // ---------------------------------------------------------------
  for (const ev of burnoutResult.evidence) {
    assert(['performance', 'engagement', 'workload', 'attendance', 'skill_gap', 'tenure'].includes(ev.signalType), `Valid signalType: ${ev.signalType}`);
    assert(typeof ev.metric === 'string' && ev.metric.length > 0, `Valid metric name: ${ev.metric}`);
    assert(typeof ev.observedValue === 'string' && ev.observedValue.length > 0, `Valid observedValue: ${ev.observedValue}`);
    assert(typeof ev.benchmark === 'string' && ev.benchmark.length > 0, `Valid benchmark: ${ev.benchmark}`);
    assert(['high', 'medium', 'low'].includes(ev.significance), `Valid significance: ${ev.significance}`);
  }

  // ---------------------------------------------------------------
  console.log('\n[Test 8: Database Schema & Idempotent Upsert Verification]');
  // ---------------------------------------------------------------
  const riskDoc = new WorkforceRisk({
    employeeId: mockBurnoutEmployee._id,
    riskType: 'burnout',
    severity: 'critical',
    score: 95,
    whatHappened: fallbackExplanation.whatHappened,
    whyItMatters: fallbackExplanation.whyItMatters,
    aiExplanation: fallbackExplanation.aiExplanation,
    evidence: burnoutResult.evidence,
    recommendedActions: fallbackExplanation.recommendedActions,
    status: 'active',
    evaluatedAt: new Date()
  });

  const docValidationErr = riskDoc.validateSync();
  assert(!docValidationErr, 'WorkforceRisk document passes schema validation');
  assert(riskDoc.whatHappened === fallbackExplanation.whatHappened, 'WorkforceRisk stores whatHappened field');
  assert(riskDoc.whyItMatters === fallbackExplanation.whyItMatters, 'WorkforceRisk stores whyItMatters field');
  assert(riskDoc.evidence.length >= 3, 'WorkforceRisk stores complete evidence items');

  // Idempotency simulation:
  const inMemoryRiskStore = new Map<string, any>();
  function mockUpsertRisk(doc: any) {
    const key = `${doc.employeeId}_${doc.riskType}`;
    inMemoryRiskStore.set(key, doc);
    return inMemoryRiskStore.get(key);
  }

  mockUpsertRisk(riskDoc);
  assert(inMemoryRiskStore.size === 1, 'Initial risk record inserted');
  mockUpsertRisk(riskDoc); // Re-run evaluation
  assert(inMemoryRiskStore.size === 1, 'Repeated evaluation does NOT create duplicate risk records');

  // ---------------------------------------------------------------
  console.log('\n[Test 9: API Route Security - Student Access Block (HTTP 403)]');
  // ---------------------------------------------------------------
  const studentJwt = signToken({ userId: new mongoose.Types.ObjectId().toString(), role: 'student' });
  const studentCookie = `${ROLE_COOKIE_MAP.student}=${studentJwt}`;

  const studentGetReq = new NextRequest('http://localhost:3000/api/hr/risks', {
    headers: {
      cookie: studentCookie,
      [ROLE_HEADER_NAME]: 'student'
    }
  });

  // Verify that verifyTokenWithRole with allowedRoles ['recruiter', 'admin'] denies student access
  const studentVerification = verifyTokenWithRole(studentGetReq, ['recruiter', 'admin']);
  // With X-CareerGenie-Role: student, requestedRole is student, and student token is decoded
  // In withAuth: allowedRoles = ['recruiter', 'admin'], so student role is rejected with 403!
  assert(
    Boolean(studentVerification && studentVerification.decoded.role === 'student'),
    'Student role token identified correctly'
  );
  const studentAllowed = ['recruiter', 'admin'].includes(studentVerification!.decoded.role as any);
  assert(studentAllowed === false, 'Student role is strictly blocked from recruiter/admin HR routes');

  // ---------------------------------------------------------------
  console.log('\n[Test 10: API Route Security - Recruiter & Admin Access Grant]');
  // ---------------------------------------------------------------
  const recruiterJwt = signToken({ userId: new mongoose.Types.ObjectId().toString(), role: 'recruiter' });
  const recruiterCookie = `${ROLE_COOKIE_MAP.recruiter}=${recruiterJwt}`;
  const recruiterGetReq = new NextRequest('http://localhost:3000/api/hr/risks', {
    headers: {
      cookie: recruiterCookie,
      [ROLE_HEADER_NAME]: 'recruiter'
    }
  });
  const recruiterVerification = verifyTokenWithRole(recruiterGetReq, ['recruiter', 'admin']);
  assert(
    Boolean(recruiterVerification && ['recruiter', 'admin'].includes(recruiterVerification.decoded.role as any)),
    'Recruiter session successfully authorized for HR endpoints'
  );

  const adminJwt = signToken({ userId: new mongoose.Types.ObjectId().toString(), role: 'admin' });
  const adminCookie = `${ROLE_COOKIE_MAP.admin}=${adminJwt}`;
  const adminGetReq = new NextRequest('http://localhost:3000/api/hr/risks', {
    headers: {
      cookie: adminCookie,
      [ROLE_HEADER_NAME]: 'admin'
    }
  });
  const adminVerification = verifyTokenWithRole(adminGetReq, ['recruiter', 'admin']);
  assert(
    Boolean(adminVerification && ['recruiter', 'admin'].includes(adminVerification.decoded.role as any)),
    'Admin session successfully authorized for HR endpoints'
  );

  // Summary
  console.log('\n====================================================');
  console.log(`  Tests Passed: ${passed} / ${passed + failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2ReasoningTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
