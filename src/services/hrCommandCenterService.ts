import mongoose from 'mongoose';
import Employee, { IEmployee } from '@/models/Employee';
import WorkforceRisk from '@/models/WorkforceRisk';
import DepartmentSkillRequirement from '@/models/DepartmentSkillRequirement';
import Job from '@/models/Job';
import JobMatch from '@/models/JobMatch';
import Application from '@/models/Application';
import InterviewEvaluation from '@/models/InterviewEvaluation';
import OnboardingPlan from '@/models/OnboardingPlan';
import PolicyDocument from '@/models/PolicyDocument';
import User from '@/models/User';
import {
  computeDepartmentSkillGaps,
  normalizeSkillName,
  BASELINE_DEPARTMENT_REQUIREMENTS,
  DepartmentName
} from '@/services/workforceSkillIntelligenceService';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PriorityInsight {
  id: string;
  category: 'compound_risk' | 'skill_gap' | 'workforce_risk' | 'recruitment' | 'onboarding' | 'policy';
  severity: InsightSeverity;
  title: string;
  summary: string;
  evidence: string[];
  affectedEntity: string;
  recommendedAction: string;
  sourceModule: 'skills' | 'risks' | 'recruitment' | 'onboarding' | 'interviews' | 'policies';
  relatedRoute: string;
}

export interface HRCommandCenterOverview {
  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    onboardingEmployees: number;
    probationEmployees: number;
    noticePeriodEmployees: number;
    departmentBreakdown: Record<string, number>;
  };
  risks: {
    totalWorkforceRisks: number;
    highCriticalRisks: number;
    affectedEmployeesCount: number;
    affectedDepartments: string[];
    criticalRiskCategories: Record<string, number>;
    topActionableRisks: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      employeeCode?: string;
      department: string;
      roleTitle: string;
      riskType: string;
      severity: string;
      score: number;
      whatHappened?: string;
      whyItMatters?: string;
      recommendedAction?: string;
    }>;
  };
  skills: {
    totalTrackedSkills: number;
    criticalSkillGapsCount: number;
    moderateSkillGapsCount: number;
    healthySkillsCount: number;
    overallVerifiedCoverageRate: number;
    departmentsWithSkillGaps: string[];
    lowestCoverageSkills: Array<{
      skill: string;
      department: string;
      targetHeadcount: number;
      verifiedHeadcount: number;
      coverageRatio: number;
      severity: string;
      hasCompoundRisk: boolean;
    }>;
    compoundSkillRetentionRisksCount: number;
  };
  recruitment: {
    activeJobsCount: number;
    candidateCount: number;
    strongMatchesCount: number; // >= 80%
    interviewingCandidatesCount: number;
    averageMatchScore: number;
    topRecruitmentOpportunities: Array<{
      jobId: string;
      title: string;
      department: string;
      openPositions: number;
      matchingCandidatesCount: number;
      topCandidateScore: number;
    }>;
  };
  interviews: {
    pipelineEvaluationsCount: number;
    averageInterviewScore: number;
    recommendationsBreakdown: {
      strong_hire: number;
      hire: number;
      borderline: number;
      do_not_hire: number;
    };
    recentEvaluations: Array<{
      id: string;
      candidateName: string;
      jobTitle: string;
      interviewStage: string;
      score: number;
      recommendation: string;
      evaluatedAt: Date | string;
    }>;
  };
  onboarding: {
    activePlansCount: number;
    onTrackCount: number;
    delayedCount: number;
    completedCount: number;
    averageProgress: number;
    employeesNeedingAttention: Array<{
      planId: string;
      employeeId: string;
      employeeName: string;
      department: string;
      roleTitle: string;
      progress: number;
      velocityScore: number;
      status: string;
      overdueMilestonesCount: number;
    }>;
  };
  policies: {
    availablePolicyCount: number;
    policyIntelligenceStatus: 'operational' | 'degraded';
    recentPolicyTopics: string[];
  };
  priorityInsights: PriorityInsight[];
}

export interface InMemoryOverviewData {
  employees?: any[];
  risks?: any[];
  skillRequirements?: any[];
  jobs?: any[];
  jobMatches?: any[];
  interviews?: any[];
  onboardingPlans?: any[];
  policies?: any[];
}

// ============================================================================
// SEVERITY RANKING HELPER
// ============================================================================

export const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

// ============================================================================
// CORE DETERMINISTIC AGGREGATION ENGINE
// ============================================================================

export function aggregateCommandCenterData(
  employees: any[],
  risks: any[],
  skillRequirements: any[],
  jobs: any[],
  jobMatches: any[],
  interviews: any[],
  onboardingPlans: any[],
  policies: any[]
): HRCommandCenterOverview {
  // --------------------------------------------------------------------------
  // 1. WORKFORCE AGGREGATION
  // --------------------------------------------------------------------------
  const totalEmployees = employees.length;
  let activeEmployees = 0;
  let onboardingEmployees = 0;
  let probationEmployees = 0;
  let noticePeriodEmployees = 0;
  const departmentBreakdown: Record<string, number> = {};

  for (const emp of employees) {
    const status = emp.status || 'active';
    if (status === 'active') activeEmployees++;
    else if (status === 'onboarding') onboardingEmployees++;
    else if (status === 'probation') probationEmployees++;
    else if (status === 'notice_period') noticePeriodEmployees++;

    const dept = emp.department || 'Unassigned';
    departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + 1;
  }

  // --------------------------------------------------------------------------
  // 2. RISK AGGREGATION
  // --------------------------------------------------------------------------
  const activeRisks = risks.filter(r => (r.status || 'active') === 'active');
  const totalWorkforceRisks = activeRisks.length;
  let highCriticalRisks = 0;
  const affectedEmployeeIdSet = new Set<string>();
  const affectedDeptSet = new Set<string>();
  const criticalRiskCategories: Record<string, number> = {
    burnout: 0,
    attrition: 0,
    disengagement: 0,
    skill_stagnation: 0
  };

  const topActionableRisks: HRCommandCenterOverview['risks']['topActionableRisks'] = [];

  // Sort risks by score descending
  const sortedRisks = [...activeRisks].sort((a, b) => (b.score || 0) - (a.score || 0));

  for (const r of sortedRisks) {
    const isSevere = r.severity === 'critical' || r.severity === 'high';
    if (isSevere) {
      highCriticalRisks++;
      const cat = r.riskType || 'attrition';
      criticalRiskCategories[cat] = (criticalRiskCategories[cat] || 0) + 1;
    }

    const empId = r.employeeId ? (r.employeeId._id ? r.employeeId._id.toString() : r.employeeId.toString()) : '';
    if (empId) affectedEmployeeIdSet.add(empId);

    // Identify department from populated employeeId or employee list
    let empName = 'Employee';
    let empCode = '';
    let roleTitle = 'Staff';
    let deptName = 'General';

    if (r.employeeId && typeof r.employeeId === 'object' && r.employeeId.name) {
      empName = r.employeeId.name;
      empCode = r.employeeId.employeeCode || '';
      roleTitle = r.employeeId.roleTitle || 'Staff';
      deptName = r.employeeId.department || 'General';
    } else {
      const matchEmp = employees.find(e => (e._id ? e._id.toString() : '') === empId);
      if (matchEmp) {
        empName = matchEmp.name;
        empCode = matchEmp.employeeCode || '';
        roleTitle = matchEmp.roleTitle || 'Staff';
        deptName = matchEmp.department || 'General';
      }
    }

    if (deptName) affectedDeptSet.add(deptName);

    if (topActionableRisks.length < 5 && isSevere) {
      topActionableRisks.push({
        id: r._id ? r._id.toString() : `risk-${topActionableRisks.length}`,
        employeeId: empId,
        employeeName: empName,
        employeeCode: empCode,
        department: deptName,
        roleTitle,
        riskType: r.riskType || 'attrition',
        severity: r.severity || 'high',
        score: r.score || 0,
        whatHappened: r.whatHappened || r.aiExplanation,
        whyItMatters: r.whyItMatters,
        recommendedAction: r.recommendedActions && r.recommendedActions[0] ? r.recommendedActions[0].title : undefined
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. SKILL INTELLIGENCE AGGREGATION
  // --------------------------------------------------------------------------
  const reqsToEvaluate = Array.isArray(skillRequirements) && skillRequirements.length > 0
    ? skillRequirements
    : (employees.length === 0 ? [] : BASELINE_DEPARTMENT_REQUIREMENTS);
  const skillGaps = computeDepartmentSkillGaps(reqsToEvaluate, employees, activeRisks, jobs, jobMatches);

  const totalTrackedSkills = skillGaps.length;
  let criticalSkillGapsCount = 0;
  let moderateSkillGapsCount = 0;
  let healthySkillsCount = 0;
  let compoundSkillRetentionRisksCount = 0;
  const departmentsWithGapsSet = new Set<string>();

  let totalVerifiedCount = 0;
  let totalTargetCoverage = 0;

  for (const gap of skillGaps) {
    totalVerifiedCount += gap.verifiedHeadcount;
    totalTargetCoverage += gap.targetHeadcount;

    if (gap.severity === 'critical') {
      criticalSkillGapsCount++;
      departmentsWithGapsSet.add(gap.department);
    } else if (gap.severity === 'moderate') {
      moderateSkillGapsCount++;
      departmentsWithGapsSet.add(gap.department);
    } else {
      healthySkillsCount++;
    }

    if (gap.hasCompoundRisk) {
      compoundSkillRetentionRisksCount++;
    }
  }

  const overallVerifiedCoverageRate = totalTargetCoverage > 0
    ? Math.round((totalVerifiedCount / totalTargetCoverage) * 100)
    : 100;

  // Find lowest coverage skills
  const lowestCoverageSkills = [...skillGaps]
    .sort((a, b) => a.coverageRatio - b.coverageRatio)
    .slice(0, 5)
    .map(g => ({
      skill: g.skillName,
      department: g.department,
      targetHeadcount: g.targetHeadcount,
      verifiedHeadcount: g.verifiedHeadcount,
      coverageRatio: g.coverageRatio,
      severity: g.severity,
      hasCompoundRisk: g.hasCompoundRisk
    }));

  // --------------------------------------------------------------------------
  // 4. RECRUITMENT AGGREGATION
  // --------------------------------------------------------------------------
  const activeJobs = jobs.filter(j => (j.status || 'active') === 'active');
  const activeJobsCount = activeJobs.length;

  const candidateCount = jobMatches.length;
  let strongMatchesCount = 0;
  let totalMatchScore = 0;

  for (const m of jobMatches) {
    const score = m.matchScore || 0;
    totalMatchScore += score;
    if (score >= 80) strongMatchesCount++;
  }

  const averageMatchScore = candidateCount > 0 ? Math.round(totalMatchScore / candidateCount) : 0;

  // Active interviewing candidate count (can come from applications or match statuses)
  let interviewingCandidatesCount = 0;
  for (const m of jobMatches) {
    if (m.status === 'interviewing' || m.status === 'shortlisted' || (m.hasInterviewEvaluation)) {
      interviewingCandidatesCount++;
    }
  }

  const topRecruitmentOpportunities: HRCommandCenterOverview['recruitment']['topRecruitmentOpportunities'] = [];
  for (const job of activeJobs.slice(0, 4)) {
    const jobIdStr = job._id ? job._id.toString() : '';
    const matchesForJob = jobMatches.filter(m => m.jobId && m.jobId.toString() === jobIdStr);
    const topScore = matchesForJob.length > 0
      ? Math.max(...matchesForJob.map(m => m.matchScore || 0))
      : 0;

    topRecruitmentOpportunities.push({
      jobId: jobIdStr,
      title: job.title,
      department: job.department || 'Engineering',
      openPositions: job.openPositions || 1,
      matchingCandidatesCount: matchesForJob.length,
      topCandidateScore: topScore
    });
  }

  // --------------------------------------------------------------------------
  // 5. INTERVIEW EVALUATIONS AGGREGATION
  // --------------------------------------------------------------------------
  const pipelineEvaluationsCount = interviews.length;
  let totalInterviewScore = 0;
  const recommendationsBreakdown = {
    strong_hire: 0,
    hire: 0,
    borderline: 0,
    do_not_hire: 0
  };

  const recentEvaluations: HRCommandCenterOverview['interviews']['recentEvaluations'] = [];

  for (const iv of interviews) {
    const score = iv.overallScore || iv.score || 0;
    totalInterviewScore += score;

    const rec = (iv.recommendation || 'borderline') as keyof typeof recommendationsBreakdown;
    if (recommendationsBreakdown[rec] !== undefined) {
      recommendationsBreakdown[rec]++;
    }

    if (recentEvaluations.length < 4) {
      recentEvaluations.push({
        id: iv._id ? iv._id.toString() : `eval-${recentEvaluations.length}`,
        candidateName: iv.studentId && typeof iv.studentId === 'object' ? iv.studentId.name : (iv.candidateName || 'Candidate'),
        jobTitle: iv.jobId && typeof iv.jobId === 'object' ? iv.jobId.title : (iv.jobTitle || 'Role'),
        interviewStage: iv.interviewStage || 'technical',
        score,
        recommendation: iv.recommendation || 'hire',
        evaluatedAt: iv.createdAt || new Date()
      });
    }
  }

  const averageInterviewScore = pipelineEvaluationsCount > 0
    ? Math.round(totalInterviewScore / pipelineEvaluationsCount)
    : 0;

  // --------------------------------------------------------------------------
  // 6. ONBOARDING AGGREGATION
  // --------------------------------------------------------------------------
  const activePlans = onboardingPlans.filter(p => p.status !== 'completed' && p.status !== 'archived');
  const activePlansCount = activePlans.length;
  let onTrackCount = 0;
  let delayedCount = 0;
  let completedCount = 0;
  let totalProgress = 0;
  const employeesNeedingAttention: HRCommandCenterOverview['onboarding']['employeesNeedingAttention'] = [];

  for (const plan of onboardingPlans) {
    if (plan.status === 'completed') completedCount++;
    else if (plan.status === 'delayed') delayedCount++;
    else onTrackCount++;

    const progress = plan.overallProgress || 0;
    totalProgress += progress;

    const overdueCount = (plan.milestones || []).filter((m: any) => m.status === 'overdue').length;

    if (plan.status === 'delayed' || overdueCount > 0 || (plan.velocityScore && plan.velocityScore < 70)) {
      let empName = 'Employee';
      let deptName = 'General';
      let roleTitle = 'Staff';

      if (plan.employeeId && typeof plan.employeeId === 'object' && plan.employeeId.name) {
        empName = plan.employeeId.name;
        deptName = plan.employeeId.department || 'General';
        roleTitle = plan.employeeId.roleTitle || 'Staff';
      } else {
        const empMatch = employees.find(e => (e._id ? e._id.toString() : '') === (plan.employeeId ? plan.employeeId.toString() : ''));
        if (empMatch) {
          empName = empMatch.name;
          deptName = empMatch.department || 'General';
          roleTitle = empMatch.roleTitle || 'Staff';
        }
      }

      employeesNeedingAttention.push({
        planId: plan._id ? plan._id.toString() : `plan-${employeesNeedingAttention.length}`,
        employeeId: plan.employeeId ? (plan.employeeId._id ? plan.employeeId._id.toString() : plan.employeeId.toString()) : '',
        employeeName: empName,
        department: deptName,
        roleTitle,
        progress,
        velocityScore: plan.velocityScore ?? 100,
        status: plan.status,
        overdueMilestonesCount: overdueCount
      });
    }
  }

  const averageProgress = onboardingPlans.length > 0
    ? Math.round(totalProgress / onboardingPlans.length)
    : 0;

  // --------------------------------------------------------------------------
  // 7. POLICIES AGGREGATION
  // --------------------------------------------------------------------------
  const availablePolicyCount = policies.length;
  const policyIntelligenceStatus: 'operational' | 'degraded' = availablePolicyCount > 0 ? 'operational' : 'degraded';
  const recentPolicyTopics = Array.from(new Set(policies.map(p => p.category || p.title))).slice(0, 5);

  // --------------------------------------------------------------------------
  // 8. CROSS-MODULE PRIORITY INSIGHT GENERATION
  // --------------------------------------------------------------------------
  const priorityInsights: PriorityInsight[] = [];
  let insightCounter = 1;

  // A. Compound Skill & Retention Risk (CRITICAL)
  for (const gap of skillGaps) {
    if (gap.hasCompoundRisk) {
      const atRiskEmployees = gap.compoundRiskDetails || [];
      priorityInsights.push({
        id: `insight-${insightCounter++}`,
        category: 'compound_risk',
        severity: 'critical',
        title: `Critical ${gap.skillName} Retention Exposure in ${gap.department}`,
        summary: `${gap.department} holds only ${gap.verifiedHeadcount}/${gap.targetHeadcount} verified ${gap.skillName} coverage, and primary practitioner(s) are flagged with severe flight or burnout risk.`,
        evidence: [
          `Verified coverage: ${Math.round(gap.coverageRatio * 100)}% (${gap.verifiedHeadcount}/${gap.targetHeadcount} target)`,
          ...atRiskEmployees.slice(0, 2),
          gap.recruitmentOpportunities && gap.recruitmentOpportunities.length > 0
            ? `Active recruitment requisition "${gap.recruitmentOpportunities[0].title}" has ${gap.recruitmentOpportunities[0].matchedCandidatesCount} candidates in pipeline.`
            : `No active job requisition currently open for ${gap.skillName}.`
        ],
        affectedEntity: `${gap.department} / ${gap.skillName}`,
        recommendedAction: `Deploy immediate retention intervention for key staff and prioritize ${gap.skillName} upskilling/hiring.`,
        sourceModule: 'skills',
        relatedRoute: '/hr/skills'
      });
    }
  }

  // B. Critical Skill Deficit with Active Recruitment Solution (HIGH)
  for (const gap of skillGaps) {
    if (gap.severity === 'critical' && !gap.hasCompoundRisk && gap.recruitmentOpportunities && gap.recruitmentOpportunities.length > 0) {
      const topOpp = gap.recruitmentOpportunities[0];
      const matchCount = topOpp.matchedCandidatesCount ?? topOpp.matchingCandidatesCount ?? 0;
      if (matchCount > 0) {
        priorityInsights.push({
          id: `insight-${insightCounter++}`,
          category: 'recruitment',
          severity: 'high',
          title: `Pipeline Match Available for Critical ${gap.skillName} Deficit`,
          summary: `${gap.department} has critical ${gap.skillName} deficit (${gap.verifiedHeadcount}/${gap.targetHeadcount}), but requisition "${topOpp.title}" has ${matchCount} ranked candidate(s).`,
          evidence: [
            `Current verified coverage: ${gap.verifiedHeadcount}/${gap.targetHeadcount}`,
            `Requisition "${topOpp.title}" open with ${topOpp.openPositions} seat(s)`,
            `Top candidate match score: ${topOpp.topCandidateScore}%`
          ],
          affectedEntity: `${gap.department} / Requisition: ${topOpp.title}`,
          recommendedAction: `Expedite interview scheduling for top candidate matches to bridge the verified capability gap.`,
          sourceModule: 'recruitment',
          relatedRoute: `/hr/recruitment?jobId=${topOpp.jobId}`
        });
      }
    }
  }

  // C. High Workforce Risk Concentration in Department (HIGH)
  for (const [dept, count] of Object.entries(departmentBreakdown)) {
    const deptRisks = activeRisks.filter(r => {
      if (r.employeeId && typeof r.employeeId === 'object' && r.employeeId.department) {
        return r.employeeId.department === dept;
      }
      const matchEmp = employees.find(e => (e._id ? e._id.toString() : '') === (r.employeeId ? r.employeeId.toString() : ''));
      return matchEmp && matchEmp.department === dept;
    });

    const severeCount = deptRisks.filter(r => r.severity === 'critical' || r.severity === 'high').length;
    if (severeCount >= 2) {
      priorityInsights.push({
        id: `insight-${insightCounter++}`,
        category: 'workforce_risk',
        severity: severeCount >= 3 ? 'critical' : 'high',
        title: `Elevated Workforce Stress Concentration in ${dept}`,
        summary: `${dept} has ${severeCount} employees exhibiting severe burnout, attrition, or disengagement signals.`,
        evidence: [
          `${severeCount} active high/critical risk profiles in ${dept}`,
          `Total department headcount: ${count} employees`,
          `Risk penetration rate: ${Math.round((severeCount / Math.max(1, count)) * 100)}%`
        ],
        affectedEntity: `Department: ${dept}`,
        recommendedAction: `Conduct workload rebalancing, 1-on-1 pulse check-ins, and manager review in ${dept}.`,
        sourceModule: 'risks',
        relatedRoute: '/hr/risks'
      });
    }
  }

  // D. Onboarding Delays in Operational Teams (HIGH/MEDIUM)
  for (const empAttention of employeesNeedingAttention) {
    if (empAttention.status === 'delayed' || empAttention.overdueMilestonesCount >= 2) {
      priorityInsights.push({
        id: `insight-${insightCounter++}`,
        category: 'onboarding',
        severity: empAttention.overdueMilestonesCount >= 2 ? 'high' : 'medium',
        title: `Onboarding Delay: ${empAttention.employeeName} (${empAttention.department})`,
        summary: `${empAttention.employeeName} (${empAttention.roleTitle}) has fallen behind onboarding schedule with ${empAttention.overdueMilestonesCount} overdue milestone(s).`,
        evidence: [
          `Current onboarding progress: ${empAttention.progress}% (Velocity Score: ${empAttention.velocityScore}/100)`,
          `${empAttention.overdueMilestonesCount} milestone(s) overdue`,
          `Department: ${empAttention.department}`
        ],
        affectedEntity: `${empAttention.employeeName} (${empAttention.roleTitle})`,
        recommendedAction: `Trigger adaptive onboarding schedule recalibration and pair with senior team mentor.`,
        sourceModule: 'onboarding',
        relatedRoute: '/hr/onboarding'
      });
    }
  }

  // E. Candidate Pipeline Ready for Decision (MEDIUM/INFO)
  if (strongMatchesCount >= 3 && activeJobsCount > 0) {
    priorityInsights.push({
      id: `insight-${insightCounter++}`,
      category: 'recruitment',
      severity: 'medium',
      title: `High-Match Candidate Surge Across Active Requisitions`,
      summary: `There are ${strongMatchesCount} candidates with >=80% deterministic match score across ${activeJobsCount} active job opening(s).`,
      evidence: [
        `${strongMatchesCount} strong matches across active requisitions`,
        `Average pipeline match score: ${averageMatchScore}%`,
        `${interviewingCandidatesCount} candidates in interview loops`
      ],
      affectedEntity: `Recruitment Pipeline (${activeJobsCount} active jobs)`,
      recommendedAction: `Review candidate shortlists and issue invitations to maintain hiring velocity.`,
      sourceModule: 'recruitment',
      relatedRoute: '/hr/recruitment'
    });
  }

  // Sort insights deterministically: critical -> high -> medium -> low -> info
  priorityInsights.sort((a, b) => {
    const rankA = SEVERITY_RANK[a.severity] ?? 99;
    const rankB = SEVERITY_RANK[b.severity] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });

  return {
    workforce: {
      totalEmployees,
      activeEmployees,
      onboardingEmployees,
      probationEmployees,
      noticePeriodEmployees,
      departmentBreakdown
    },
    risks: {
      totalWorkforceRisks,
      highCriticalRisks,
      affectedEmployeesCount: affectedEmployeeIdSet.size,
      affectedDepartments: Array.from(affectedDeptSet),
      criticalRiskCategories,
      topActionableRisks
    },
    skills: {
      totalTrackedSkills,
      criticalSkillGapsCount,
      moderateSkillGapsCount,
      healthySkillsCount,
      overallVerifiedCoverageRate,
      departmentsWithSkillGaps: Array.from(departmentsWithGapsSet),
      lowestCoverageSkills,
      compoundSkillRetentionRisksCount
    },
    recruitment: {
      activeJobsCount,
      candidateCount,
      strongMatchesCount,
      interviewingCandidatesCount,
      averageMatchScore,
      topRecruitmentOpportunities
    },
    interviews: {
      pipelineEvaluationsCount,
      averageInterviewScore,
      recommendationsBreakdown,
      recentEvaluations
    },
    onboarding: {
      activePlansCount,
      onTrackCount,
      delayedCount,
      completedCount,
      averageProgress,
      employeesNeedingAttention
    },
    policies: {
      availablePolicyCount,
      policyIntelligenceStatus,
      recentPolicyTopics
    },
    priorityInsights
  };
}

// ============================================================================
// MAIN SERVICE ENTRYPOINT
// ============================================================================

/**
 * Retrieves the unified HR Command Center overview across all intelligence pillars.
 * Restricted server-side to recruiter and admin roles.
 */
export async function getHRCommandCenterOverview(
  userId: string,
  userRole: 'recruiter' | 'admin',
  inMemoryData?: InMemoryOverviewData
): Promise<HRCommandCenterOverview> {
  // If in-memory mock data is passed (e.g. from unit tests), process deterministically without DB calls
  if (inMemoryData) {
    return aggregateCommandCenterData(
      inMemoryData.employees || [],
      inMemoryData.risks || [],
      inMemoryData.skillRequirements || [],
      inMemoryData.jobs || [],
      inMemoryData.jobMatches || [],
      inMemoryData.interviews || [],
      inMemoryData.onboardingPlans || [],
      inMemoryData.policies || []
    );
  }

  // Live database aggregation
  const [
    employees,
    risks,
    skillRequirements,
    jobs,
    jobMatches,
    interviews,
    onboardingPlans,
    policies
  ] = await Promise.all([
    Employee.find({}).lean(),
    WorkforceRisk.find({ status: 'active' }).populate('employeeId', 'name email employeeCode department roleTitle level flightRiskLevel').lean(),
    DepartmentSkillRequirement.find({}).lean(),
    Job.find({ status: 'active' }).lean(),
    JobMatch.find({}).lean(),
    InterviewEvaluation.find({}).populate('studentId', 'name email').populate('jobId', 'title').sort({ createdAt: -1 }).limit(10).lean(),
    OnboardingPlan.find({}).populate('employeeId', 'name email employeeCode department roleTitle').lean(),
    PolicyDocument.find({}).lean()
  ]);

  return aggregateCommandCenterData(
    employees,
    risks,
    skillRequirements,
    jobs,
    jobMatches,
    interviews,
    onboardingPlans,
    policies
  );
}
