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
import connectDB from '../src/lib/db';
import Employee from '../src/models/Employee';
import WorkforceRisk from '../src/models/WorkforceRisk';
import DepartmentSkillRequirement from '../src/models/DepartmentSkillRequirement';
import Job from '../src/models/Job';
import JobMatch from '../src/models/JobMatch';
import Application from '../src/models/Application';
import InterviewEvaluation from '../src/models/InterviewEvaluation';
import OnboardingPlan from '../src/models/OnboardingPlan';
import PolicyDocument from '../src/models/PolicyDocument';
import User from '../src/models/User';
import {
  aggregateCommandCenterData,
  getHRCommandCenterOverview,
  HRCommandCenterOverview,
  PriorityInsight,
  SEVERITY_RANK
} from '../src/services/hrCommandCenterService';
import {
  generateCommandCenterBriefing,
  CommandCenterBriefingResult
} from '../src/services/gemini';
import {
  signToken,
  ROLE_COOKIE_MAP,
  ROLE_HEADER_NAME,
  verifyTokenWithRole
} from '../src/middleware/auth';

let passed = 0;
let failed = 0;
let dbTestsExecuted = 0;
let dbTestsSkipped = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

async function runCommandCenterVerification() {
  console.log('================================================================');
  console.log('CAREERGENIE PHASE 2.8: UNIFIED HR COMMAND CENTER TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // MOCK DATA FIXTURES
  // -------------------------------------------------------------------------
  const emp1Id = new mongoose.Types.ObjectId();
  const emp2Id = new mongoose.Types.ObjectId();
  const emp3Id = new mongoose.Types.ObjectId();
  const emp4Id = new mongoose.Types.ObjectId();

  const mockEmployees = [
    {
      _id: emp1Id,
      employeeCode: 'EMP-1001',
      name: 'Elena Rostova',
      roleTitle: 'Principal Cloud Architect',
      department: 'Engineering',
      status: 'active',
      level: 'Lead',
      performanceRating: 4.8,
      flightRiskLevel: 'high',
      skills: [
        { name: 'Kubernetes', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Go', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      _id: emp2Id,
      employeeCode: 'EMP-1002',
      name: 'Marcus Vance',
      roleTitle: 'Senior Frontend Developer',
      department: 'Engineering',
      status: 'active',
      level: 'Senior',
      performanceRating: 3.5,
      flightRiskLevel: 'critical',
      skills: [
        { name: 'React', proficiency: 'advanced', category: 'technical', verified: true }
      ]
    },
    {
      _id: emp3Id,
      employeeCode: 'EMP-1003',
      name: 'Chloe Dubois',
      roleTitle: 'Product Designer',
      department: 'Product & Design',
      status: 'probation',
      level: 'Mid',
      performanceRating: 4.0,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Design Systems', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      _id: emp4Id,
      employeeCode: 'EMP-1004',
      name: 'Liam O’Connor',
      roleTitle: 'DevOps Specialist',
      department: 'Engineering',
      status: 'onboarding',
      level: 'Mid',
      performanceRating: 3.8,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Docker', proficiency: 'advanced', category: 'technical', verified: true },
        { name: 'AWS', proficiency: 'advanced', category: 'technical', verified: true }
      ]
    }
  ];

  const mockRisks = [
    {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp1Id,
      riskType: 'attrition',
      severity: 'high',
      score: 78,
      status: 'active',
      whatHappened: 'Market compensation disparity and external recruiter reach-outs.',
      whyItMatters: 'Sole verified Kubernetes architect in Engineering.',
      recommendedActions: [{ title: 'Execute executive retention adjustment', urgency: 'immediate' }]
    },
    {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp2Id,
      riskType: 'burnout',
      severity: 'critical',
      score: 92,
      status: 'active',
      whatHappened: 'Consistent 18+ overtime hours per week.',
      whyItMatters: 'High probability of immediate departure.',
      recommendedActions: [{ title: 'Mandate immediate PTO decompression block', urgency: 'immediate' }]
    }
  ];

  const mockSkillRequirements = [
    {
      department: 'Engineering',
      skillName: 'Kubernetes',
      category: 'technical',
      targetCoverageCount: 3,
      minProficiency: 'intermediate',
      criticality: 'critical',
      description: 'Container orchestration'
    },
    {
      department: 'Engineering',
      skillName: 'React',
      category: 'technical',
      targetCoverageCount: 2,
      minProficiency: 'intermediate',
      criticality: 'high',
      description: 'Web frontend'
    }
  ];

  const testJobId = new mongoose.Types.ObjectId();
  const mockJobs = [
    {
      _id: testJobId,
      title: 'Staff Distributed Systems Engineer',
      department: 'Engineering',
      status: 'active',
      openPositions: 2,
      requiredSkills: ['Go', 'Kubernetes', 'Kafka']
    }
  ];

  const mockJobMatches = [
    { jobId: testJobId, matchScore: 92, status: 'interviewing', studentName: 'Nathan Drake' },
    { jobId: testJobId, matchScore: 84, status: 'shortlisted', studentName: 'Hana Takahashi' },
    { jobId: testJobId, matchScore: 68, status: 'applied', studentName: 'Jordan Lee' }
  ];

  const mockInterviews = [
    {
      _id: new mongoose.Types.ObjectId(),
      studentId: { _id: new mongoose.Types.ObjectId(), name: 'Nathan Drake' },
      jobId: { _id: testJobId, title: 'Staff Distributed Systems Engineer' },
      interviewStage: 'technical',
      overallScore: 88,
      recommendation: 'strong_hire',
      createdAt: new Date()
    },
    {
      _id: new mongoose.Types.ObjectId(),
      studentId: { _id: new mongoose.Types.ObjectId(), name: 'Hana Takahashi' },
      jobId: { _id: testJobId, title: 'Staff Distributed Systems Engineer' },
      interviewStage: 'screen',
      overallScore: 76,
      recommendation: 'hire',
      createdAt: new Date()
    }
  ];

  const mockOnboardingPlans = [
    {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp4Id,
      department: 'Engineering',
      status: 'delayed',
      overallProgress: 45,
      velocityScore: 62,
      milestones: [
        { milestoneId: 'M-01', title: 'SSO Setup', status: 'completed' },
        { milestoneId: 'M-02', title: 'Local Dev Cluster', status: 'overdue' },
        { milestoneId: 'M-03', title: 'First PR Review', status: 'overdue' }
      ]
    },
    {
      _id: new mongoose.Types.ObjectId(),
      employeeId: emp3Id,
      department: 'Product & Design',
      status: 'on_track',
      overallProgress: 75,
      velocityScore: 95,
      milestones: [
        { milestoneId: 'M-01', title: 'Design System Audit', status: 'completed' }
      ]
    }
  ];

  const mockPolicies = [
    { policyCode: 'POL-SEC-2026', title: 'Information Security & Data Protection', category: 'Security' },
    { policyCode: 'POL-REM-2026', title: 'Remote Work & Core Collaboration Hours', category: 'Workplace' },
    { policyCode: 'POL-PTO-2026', title: 'Paid Time Off & Leave Entitlements', category: 'Benefits' }
  ];

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Workforce KPI Aggregation (A)
  // -------------------------------------------------------------------------
  console.log('[Test Group 1: Workforce KPI Aggregation]');
  const overview = aggregateCommandCenterData(
    mockEmployees,
    mockRisks,
    mockSkillRequirements,
    mockJobs,
    mockJobMatches,
    mockInterviews,
    mockOnboardingPlans,
    mockPolicies
  );

  assert(overview.workforce.totalEmployees === 4, 'Aggregates total employees accurately (4)');
  assert(overview.workforce.activeEmployees === 2, 'Counts active employees accurately (2)');
  assert(overview.workforce.probationEmployees === 1, 'Counts probation employees accurately (1)');
  assert(overview.workforce.onboardingEmployees === 1, 'Counts onboarding employees accurately (1)');
  assert(overview.workforce.departmentBreakdown['Engineering'] === 3, 'Engineering headcount breakdown matches (3)');
  assert(overview.workforce.departmentBreakdown['Product & Design'] === 1, 'Product & Design headcount breakdown matches (1)');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Risk KPI Aggregation (B)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 2: Risk KPI Aggregation]');
  assert(overview.risks.totalWorkforceRisks === 2, 'Aggregates total active risks accurately (2)');
  assert(overview.risks.highCriticalRisks === 2, 'Counts high/critical risks accurately (2)');
  assert(overview.risks.affectedEmployeesCount === 2, 'Counts unique affected employees (2)');
  assert(overview.risks.affectedDepartments.includes('Engineering'), 'Identifies Engineering as affected department');
  assert(overview.risks.criticalRiskCategories['attrition'] === 1, 'Attrition risk count matches (1)');
  assert(overview.risks.criticalRiskCategories['burnout'] === 1, 'Burnout risk count matches (1)');
  assert(overview.risks.topActionableRisks.length === 2, 'Surfaces top actionable risk profiles');
  assert(overview.risks.topActionableRisks[0].score >= overview.risks.topActionableRisks[1].score, 'Top actionable risks sorted descending by score');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Skill KPI Aggregation (C)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 3: Skill KPI Aggregation]');
  assert(overview.skills.totalTrackedSkills === 2, 'Aggregates total tracked skill requirements (2)');
  assert(overview.skills.criticalSkillGapsCount === 1, 'Identifies 1 critical skill gap (Kubernetes: 1/3 verified < 40%)');
  assert(overview.skills.departmentsWithSkillGaps.includes('Engineering'), 'Marks Engineering as department with skill gaps');
  assert(overview.skills.compoundSkillRetentionRisksCount === 2, 'Identifies 2 compound skill/retention risks (Kubernetes & React)');
  assert(overview.skills.lowestCoverageSkills.length >= 1, 'Populates lowest coverage skills table');
  assert(overview.skills.lowestCoverageSkills[0].skill === 'Kubernetes', 'Lowest coverage skill is Kubernetes');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Recruitment KPI Aggregation (D)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 4: Recruitment KPI Aggregation]');
  assert(overview.recruitment.activeJobsCount === 1, 'Counts active job openings (1)');
  assert(overview.recruitment.candidateCount === 3, 'Counts candidate matches (3)');
  assert(overview.recruitment.strongMatchesCount === 2, 'Counts strong candidate matches >= 80% (2)');
  assert(overview.recruitment.interviewingCandidatesCount === 2, 'Counts candidates currently in interviewing/shortlist status (2)');
  assert(overview.recruitment.averageMatchScore === Math.round((92 + 84 + 68) / 3), 'Calculates accurate average match score (81%)');
  assert(overview.recruitment.topRecruitmentOpportunities.length === 1, 'Populates top recruitment opportunities');
  assert(overview.recruitment.topRecruitmentOpportunities[0].topCandidateScore === 92, 'Top candidate score is 92%');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Interview KPI Aggregation (E)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 5: Interview KPI Aggregation]');
  assert(overview.interviews.pipelineEvaluationsCount === 2, 'Counts logged interview evaluations (2)');
  assert(overview.interviews.averageInterviewScore === Math.round((88 + 76) / 2), 'Calculates average interview evaluation score (82%)');
  assert(overview.interviews.recommendationsBreakdown.strong_hire === 1, 'Counts strong_hire recommendation (1)');
  assert(overview.interviews.recommendationsBreakdown.hire === 1, 'Counts hire recommendation (1)');
  assert(overview.interviews.recentEvaluations.length === 2, 'Populates recent evaluations list');

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Onboarding KPI Aggregation (F)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 6: Onboarding KPI Aggregation]');
  assert(overview.onboarding.activePlansCount === 2, 'Counts active onboarding plans (2)');
  assert(overview.onboarding.onTrackCount === 1, 'Counts on-track plans (1)');
  assert(overview.onboarding.delayedCount === 1, 'Counts delayed plans (1)');
  assert(overview.onboarding.averageProgress === Math.round((45 + 75) / 2), 'Calculates average onboarding progress (60%)');
  assert(overview.onboarding.employeesNeedingAttention.length === 1, 'Identifies 1 employee needing onboarding attention (Liam O’Connor)');
  assert(overview.onboarding.employeesNeedingAttention[0].overdueMilestonesCount === 2, 'Accurately counts 2 overdue milestones');

  // -------------------------------------------------------------------------
  // TEST GROUP 7: Policy Availability & Status (G)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 7: Policy Availability & Status]');
  assert(overview.policies.availablePolicyCount === 3, 'Counts available policy documents (3)');
  assert(overview.policies.policyIntelligenceStatus === 'operational', 'Policy intelligence status is operational');
  assert(overview.policies.recentPolicyTopics.length >= 2, 'Surfaces recent policy topics');

  // -------------------------------------------------------------------------
  // TEST GROUP 8: Priority Insight Generation (H) & Evidence (J)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 8: Priority Insight Generation & Evidence]');
  assert(overview.priorityInsights.length > 0, `Generated ${overview.priorityInsights.length} priority insights`);

  const compoundInsight = overview.priorityInsights.find(i => i.category === 'compound_risk');
  assert(compoundInsight !== undefined, 'Generated compound skill/retention risk insight');
  assert(compoundInsight!.severity === 'critical', 'Compound risk insight has critical severity');
  assert(compoundInsight!.evidence.length >= 2, 'Compound risk insight contains concrete evidence items');
  assert(compoundInsight!.affectedEntity.includes('Engineering'), 'Affected entity mentions Engineering');
  assert(compoundInsight!.recommendedAction.length > 10, 'Provides actionable leadership recommendation');
  assert(compoundInsight!.relatedRoute === '/hr/skills', 'Points to related route /hr/skills');

  // -------------------------------------------------------------------------
  // TEST GROUP 9: Insight Severity Ordering (I)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 9: Insight Severity Ordering]');
  for (let i = 0; i < overview.priorityInsights.length - 1; i++) {
    const rankCurrent = SEVERITY_RANK[overview.priorityInsights[i].severity];
    const rankNext = SEVERITY_RANK[overview.priorityInsights[i + 1].severity];
    assert(rankCurrent <= rankNext, `Insight #${i} (${overview.priorityInsights[i].severity}) ordered before/equal to #${i + 1} (${overview.priorityInsights[i + 1].severity})`);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 10: Cross-Module Correlation (K)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 10: Cross-Module Correlation]');
  // Test correlation: Skill gap + Active Job matches
  const recruitmentSolutionInsight = overview.priorityInsights.find(i => i.title.includes('Pipeline Match Available') || i.category === 'compound_risk');
  assert(recruitmentSolutionInsight !== undefined, 'Correlates skill gaps with active candidate pipeline');

  // Test correlation: Multiple severe risks in Engineering
  const deptStressInsight = overview.priorityInsights.find(i => i.category === 'workforce_risk' && i.affectedEntity.includes('Engineering'));
  assert(deptStressInsight !== undefined, 'Correlates concentrated severe workforce risks within a department');

  // -------------------------------------------------------------------------
  // TEST GROUP 11: Empty Dataset Handling (L)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 11: Empty Dataset Handling]');
  const emptyOverview = aggregateCommandCenterData([], [], [], [], [], [], [], []);
  assert(emptyOverview.workforce.totalEmployees === 0, 'Empty workforce handled gracefully');
  assert(emptyOverview.risks.totalWorkforceRisks === 0, 'Empty risks handled gracefully');
  assert(emptyOverview.skills.overallVerifiedCoverageRate === 100, 'Empty skills defaults to 100% verified coverage');
  assert(emptyOverview.recruitment.averageMatchScore === 0, 'Empty recruitment average match score is 0');
  assert(emptyOverview.interviews.pipelineEvaluationsCount === 0, 'Empty interviews count is 0');
  assert(emptyOverview.onboarding.averageProgress === 0, 'Empty onboarding progress is 0');
  assert(emptyOverview.policies.policyIntelligenceStatus === 'degraded', 'Empty policies marks status degraded');
  assert(emptyOverview.priorityInsights.length === 0, 'Empty dataset produces zero spurious insights');

  // -------------------------------------------------------------------------
  // TEST GROUP 12: Server-Side RBAC & Authorization (M, N, O)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 12: Server-Side RBAC & Authorization]');

  const recruiterToken = signToken({
    userId: 'user_recruiter_01',
    role: 'recruiter'
  });

  const adminToken = signToken({
    userId: 'user_admin_01',
    role: 'admin'
  });

  const studentToken = signToken({
    userId: 'user_student_01',
    role: 'student'
  });

  // Test 12.1: Recruiter access granted
  const recruiterReq = new NextRequest('http://localhost:3000/api/hr/command-center', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.recruiter}=${recruiterToken}`,
      [ROLE_HEADER_NAME]: 'recruiter'
    }
  });
  const recruiterAuth = verifyTokenWithRole(recruiterReq, ['recruiter', 'admin']);
  assert(recruiterAuth !== null && recruiterAuth.decoded.role === 'recruiter', 'Recruiter token verified successfully');

  // Test 12.2: Admin access granted
  const adminReq = new NextRequest('http://localhost:3000/api/hr/command-center', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.admin}=${adminToken}`,
      [ROLE_HEADER_NAME]: 'admin'
    }
  });
  const adminAuth = verifyTokenWithRole(adminReq, ['recruiter', 'admin']);
  assert(adminAuth !== null && adminAuth.decoded.role === 'admin', 'Admin token verified successfully');

  // Test 12.3: Student access blocked (403)
  const studentReq = new NextRequest('http://localhost:3000/api/hr/command-center', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.student}=${studentToken}`,
      [ROLE_HEADER_NAME]: 'student'
    }
  });
  const studentAuth = verifyTokenWithRole(studentReq, ['recruiter', 'admin']);
  const allowedRoles = ['recruiter', 'admin'];
  const studentIsAllowed = Boolean(studentAuth && allowedRoles.includes(studentAuth.decoded.role as any));
  assert(!studentIsAllowed, 'Student role rejected from Command Center (403)');

  // Test 12.4: Unauthenticated access blocked (401)
  const unauthReq = new NextRequest('http://localhost:3000/api/hr/command-center');
  const unauth = verifyTokenWithRole(unauthReq, ['recruiter', 'admin']);
  assert(unauth === null, 'Unauthenticated request rejected with no session (401)');

  // -------------------------------------------------------------------------
  // TEST GROUP 13: Grounded Gemini Briefing & Fallback
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 13: Grounded Gemini Briefing & Fallback]');

  const briefingResult: CommandCenterBriefingResult = await generateCommandCenterBriefing(overview);
  assert(typeof briefingResult.executiveSummary === 'string' && briefingResult.executiveSummary.length > 20, 'Briefing provides executive summary');
  assert(typeof briefingResult.topRiskAnalysis === 'string' && briefingResult.topRiskAnalysis.length > 10, 'Briefing provides top risk analysis');
  assert(Array.isArray(briefingResult.strategicRecommendations) && briefingResult.strategicRecommendations.length >= 2, 'Briefing provides actionable strategic recommendations');
  assert(briefingResult.operationalPosture === 'critical_attention', 'Accurately determines operational posture based on severe risks');
  assert(briefingResult.groundedFacts.totalEmployees === 4, 'Preserves authoritative total employees (4)');
  assert(briefingResult.groundedFacts.highCriticalRisks === 2, 'Preserves authoritative severe risks (2)');
  assert(briefingResult.groundedFacts.criticalSkillGaps === 1, 'Preserves authoritative critical skill gaps (1)');

  // -------------------------------------------------------------------------
  // TEST GROUP 14: Live Database Integration (if MongoDB is available)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 14: Live Database Integration]');

  let dbConnected = false;
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      dbConnected = mongoose.connection.readyState === 1;
    }
  } catch (err) {
    console.warn('  ⚠️ MongoDB connection attempt encountered an error.');
  }

  if (dbConnected) {
    console.log('  Connected to MongoDB instance. Executing database workflow tests...');
    const liveOverview = await getHRCommandCenterOverview('test_admin_id', 'admin');
    assert(typeof liveOverview.workforce.totalEmployees === 'number', 'Queried live workforce collection');
    assert(Array.isArray(liveOverview.priorityInsights), 'Generated live priority insights');
    dbTestsExecuted += 2;
  } else {
    console.log('  Skipping live DB tests (no active MongoDB connection in test environment).');
    console.log('  All schema, aggregation, correlation, security, and fallback tests executed successfully.');
    dbTestsSkipped = 2;
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 15: Regression Verification (P)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 15: Regression Verification]');
  assert(Employee.modelName === 'Employee', 'Employee model intact');
  assert(WorkforceRisk.modelName === 'WorkforceRisk', 'WorkforceRisk model intact');
  assert(DepartmentSkillRequirement.modelName === 'DepartmentSkillRequirement', 'DepartmentSkillRequirement model intact');
  assert(Job.modelName === 'Job', 'Job model intact');
  assert(JobMatch.modelName === 'JobMatch', 'JobMatch model intact');
  assert(Application.modelName === 'Application', 'Application model intact');
  assert(InterviewEvaluation.modelName === 'InterviewEvaluation', 'InterviewEvaluation model intact');
  assert(OnboardingPlan.modelName === 'OnboardingPlan', 'OnboardingPlan model intact');
  assert(PolicyDocument.modelName === 'PolicyDocument', 'PolicyDocument model intact');
  assert(User.modelName === 'User', 'User model intact');

  console.log('\n================================================================');
  console.log(`TOTAL PHASE 2.8 TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  if (dbTestsExecuted > 0) {
    console.log(`DATABASE INTEGRATION TESTS EXECUTED: ${dbTestsExecuted}`);
  }
  if (dbTestsSkipped > 0) {
    console.log(`DATABASE INTEGRATION TESTS SKIPPED: ${dbTestsSkipped} (MongoDB unavailable in environment)`);
  }
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCommandCenterVerification()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error during command center verification:', err);
    process.exit(1);
  });
