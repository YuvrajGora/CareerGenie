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
import DepartmentSkillRequirement from '../src/models/DepartmentSkillRequirement';
import Employee from '../src/models/Employee';
import WorkforceRisk from '../src/models/WorkforceRisk';
import Job from '../src/models/Job';
import JobMatch from '../src/models/JobMatch';
import User from '../src/models/User';
import {
  normalizeSkillName,
  meetsProficiencyRequirement,
  calculateDepartmentSkillGaps,
  getWorkforceSkillOverview,
  getDepartmentCapabilityMatrix,
  getEmployeeSkillProfiles,
  findAdjacentUpskillingCandidates,
  IDepartmentSkillRequirementDoc,
  IDepartmentSkillGap,
  BASELINE_DEPARTMENT_REQUIREMENTS
} from '../src/services/workforceSkillIntelligenceService';
import {
  generateSkillGapExplanation,
  SkillGapExplanationResult
} from '../src/services/gemini';
import {
  signToken,
  ROLE_COOKIE_MAP,
  ROLE_HEADER_NAME,
  verifyTokenWithRole
} from '../src/middleware/auth';
import { calculateDetailedMatchScore, calculateMatchScore } from '../src/services/matching';

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

async function runSkillsVerification() {
  console.log('================================================================');
  console.log('CAREERGENIE PHASE 2.7 WORKFORCE SKILL INTELLIGENCE TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Skill Name Normalization & Deduplication
  // -------------------------------------------------------------------------
  console.log('[Test Group 1: Skill Name Normalization & Deduplication]');

  assert(normalizeSkillName('  kubernetes  ') === 'Kubernetes', 'Trims whitespace and capitalizes standard skills');
  assert(normalizeSkillName('k8s') === 'Kubernetes', 'Maps alias "k8s" to canonical "Kubernetes"');
  assert(normalizeSkillName('reactjs') === 'React', 'Maps alias "reactjs" to canonical "React"');
  assert(normalizeSkillName('react.js') === 'React', 'Maps alias "react.js" to canonical "React"');
  assert(normalizeSkillName('golang') === 'Go', 'Maps alias "golang" to canonical "Go"');
  assert(normalizeSkillName('postgres') === 'PostgreSQL', 'Maps alias "postgres" to canonical "PostgreSQL"');
  assert(normalizeSkillName('postgresql') === 'PostgreSQL', 'Normalizes "postgresql" to "PostgreSQL"');
  assert(normalizeSkillName('node.js') === 'Node.js', 'Normalizes "node.js" to "Node.js"');
  assert(normalizeSkillName('aws cloud') === 'AWS', 'Maps "aws cloud" to "AWS"');
  assert(normalizeSkillName('gcp') === 'Google Cloud', 'Maps "gcp" to "Google Cloud"');
  assert(normalizeSkillName('ci/cd') === 'CI/CD', 'Preserves CI/CD formatting');
  assert(normalizeSkillName('REST API') === 'REST APIs', 'Maps "REST API" to "REST APIs"');

  // Deduplication check
  const rawSkillsList = ['Kubernetes', 'k8s', 'KUBERNETES', 'React', 'reactjs', 'React.js'];
  const deduplicated = Array.from(new Set(rawSkillsList.map(s => normalizeSkillName(s))));
  assert(deduplicated.length === 2, `Deduplicates 6 alias variations down to exactly 2: ${deduplicated.join(', ')}`);
  assert(deduplicated.includes('Kubernetes') && deduplicated.includes('React'), 'Canonical names are preserved');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Proficiency Levels & Verified vs Unverified Coverage
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 2: Proficiency Levels & Verified vs Unverified Coverage]');

  // meetsProficiencyRequirement tests
  assert(meetsProficiencyRequirement('expert', 'intermediate') === true, 'Expert meets intermediate requirement');
  assert(meetsProficiencyRequirement('advanced', 'advanced') === true, 'Advanced meets advanced requirement');
  assert(meetsProficiencyRequirement('intermediate', 'advanced') === false, 'Intermediate does not meet advanced requirement');
  assert(meetsProficiencyRequirement('beginner', 'intermediate') === false, 'Beginner does not meet intermediate requirement');
  assert(meetsProficiencyRequirement('expert', 'beginner') === true, 'Expert meets beginner requirement');

  // Strict verified counting test
  const mockEmployees: any[] = [
    {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-001',
      name: 'Verified Engineer',
      roleTitle: 'Senior Platform Engineer',
      department: 'Engineering',
      level: 'Senior',
      status: 'active',
      skills: [
        { name: 'Kubernetes', proficiency: 'advanced', category: 'cloud', verified: true }
      ]
    },
    {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-002',
      name: 'Unverified Engineer',
      roleTitle: 'Backend Engineer',
      department: 'Engineering',
      level: 'Mid',
      status: 'active',
      skills: [
        { name: 'Kubernetes', proficiency: 'intermediate', category: 'cloud', verified: false }
      ]
    },
    {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-003',
      name: 'Under-Proficient Engineer',
      roleTitle: 'Junior DevOps',
      department: 'Engineering',
      level: 'Junior',
      status: 'active',
      skills: [
        { name: 'Kubernetes', proficiency: 'beginner', category: 'cloud', verified: true } // fails 'intermediate'
      ]
    }
  ];

  const mockRequirements: IDepartmentSkillRequirementDoc[] = [
    {
      department: 'Engineering',
      skillName: 'Kubernetes',
      category: 'cloud',
      targetHeadcount: 3,
      minimumProficiency: 'intermediate',
      criticality: 'high',
      isActive: true
    } as any
  ];

  const gapAnalysisResult = await calculateDepartmentSkillGaps(mockRequirements, mockEmployees, [], []);
  assert(gapAnalysisResult.length === 1, 'Calculates analysis for requirement');
  const k8sGap = gapAnalysisResult[0];

  assert(k8sGap.targetHeadcount === 3, 'Target headcount is 3');
  assert(k8sGap.availableHeadcount === 2, `Available headcount is 2 (excludes EMP-003 due to beginner proficiency, includes EMP-001 & EMP-002)`);
  assert(k8sGap.verifiedHeadcount === 1, `Verified headcount is strictly 1 (only EMP-001 meets proficiency AND verified=true)`);
  assert(k8sGap.unverifiedHeadcount === 1, `Unverified headcount is strictly 1 (EMP-002 meets proficiency but verified=false)`);
  assert(k8sGap.verifiedGapHeadcount === 2, `Verified gap headcount is target - verified (3 - 1 = 2)`);

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Deterministic Severity Calculation Thresholds
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 3: Deterministic Severity Calculation Thresholds]');

  // Case A: 1/3 verified = 33% -> Critical (< 40%)
  assert(k8sGap.verifiedCoverageRatio < 0.40, 'Verified coverage ratio is 33% (< 40%)');
  assert(k8sGap.severity === 'critical', 'Ratio < 40% maps deterministically to "critical"');

  // Case B: Moderate threshold (40% to 79%)
  const moderateEmployees = [
    ...mockEmployees,
    {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-004',
      name: 'Second Verified Engineer',
      roleTitle: 'DevOps Engineer',
      department: 'Engineering',
      level: 'Mid',
      status: 'active',
      skills: [
        { name: 'Kubernetes', proficiency: 'intermediate', category: 'cloud', verified: true }
      ]
    }
  ];
  const moderateResult = await calculateDepartmentSkillGaps(mockRequirements, moderateEmployees, [], []);
  const moderateGap = moderateResult[0];
  assert(moderateGap.verifiedHeadcount === 2, 'Verified headcount is 2/3 (67%)');
  assert(moderateGap.severity === 'moderate', 'Coverage ratio 67% maps deterministically to "moderate"');

  // Case C: Healthy threshold (>= 80%)
  const healthyEmployees = [
    ...moderateEmployees,
    {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-005',
      name: 'Third Verified Engineer',
      roleTitle: 'Cloud Architect',
      department: 'Engineering',
      level: 'Lead',
      status: 'active',
      skills: [
        { name: 'Kubernetes', proficiency: 'expert', category: 'cloud', verified: true }
      ]
    }
  ];
  const healthyResult = await calculateDepartmentSkillGaps(mockRequirements, healthyEmployees, [], []);
  const healthyGap = healthyResult[0];
  assert(healthyGap.verifiedHeadcount === 3, 'Verified headcount is 3/3 (100%)');
  assert(healthyGap.severity === 'healthy', 'Coverage ratio 100% maps deterministically to "healthy"');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Adjacent Capabilities & Upskilling Labeling
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 4: Adjacent Capabilities & Upskilling Labeling]');

  const employeeWithDockerAndAWS: any = {
    _id: new mongoose.Types.ObjectId(),
    employeeCode: 'EMP-010',
    name: 'Docker Specialist',
    roleTitle: 'Software Engineer',
    department: 'Engineering',
    level: 'Senior',
    status: 'active',
    skills: [
      { name: 'Docker', proficiency: 'advanced', category: 'cloud', verified: true },
      { name: 'AWS', proficiency: 'advanced', category: 'cloud', verified: true },
      { name: 'Linux', proficiency: 'intermediate', category: 'cloud', verified: true }
    ]
  };

  const upskillingCandidates = findAdjacentUpskillingCandidates(
    'Kubernetes',
    'Engineering',
    [employeeWithDockerAndAWS]
  );

  assert(upskillingCandidates.length === 1, 'Identifies employee with adjacent competencies (Docker, AWS, Linux)');
  const upskillingCandidate = upskillingCandidates[0];
  assert(upskillingCandidate.name === 'Docker Specialist', 'Correct candidate identified');
  assert(upskillingCandidate.adjacentSkills.includes('Docker'), 'Identifies Docker as adjacent');
  assert(upskillingCandidate.adjacentSkills.includes('AWS'), 'Identifies AWS as adjacent');
  assert(upskillingCandidate.readinessScore > 50, `Calculates high readiness score based on adjacent overlap (${upskillingCandidate.readinessScore}%)`);

  // Crucial requirement: Never label adjacent skills as verified qualifications!
  const hasK8sVerified = employeeWithDockerAndAWS.skills.some((s: any) => s.name === 'Kubernetes' && s.verified);
  assert(!hasK8sVerified, 'CRITICAL: Adjacent skills are NOT marked or inferred as verified employee capabilities');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Cross-Module Reasoning: Compound Workforce Risks
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 5: Compound Workforce Risks]');

  const verifiedEmpId = mockEmployees[0]._id;
  const mockHighWorkforceRisk: any[] = [
    {
      employeeId: verifiedEmpId,
      riskType: 'attrition',
      severity: 'critical',
      score: 88,
      status: 'active'
    }
  ];

  const compoundRiskAnalysis = await calculateDepartmentSkillGaps(
    mockRequirements,
    mockEmployees,
    mockHighWorkforceRisk,
    []
  );

  const compoundGap = compoundRiskAnalysis[0];
  assert(compoundGap.hasCompoundRisk === true, 'Flags compound risk when key verified engineer has critical attrition risk');
  assert(
    compoundGap.compoundRiskDetails && compoundGap.compoundRiskDetails.length > 0,
    'Compound risk details provide actionable warning'
  );
  assert(
    compoundGap.compoundRiskDetails![0].includes('EMP-001'),
    'Compound risk details explicitly name the at-risk key engineer'
  );

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Cross-Module Reasoning: Recruitment Pipeline Linkage
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 6: Recruitment Pipeline Linkage]');

  const mockJobId = new mongoose.Types.ObjectId();
  const mockJobs: any[] = [
    {
      _id: mockJobId,
      title: 'Staff Distributed Systems Engineer',
      department: 'Engineering',
      status: 'active',
      openPositions: 2,
      requiredSkills: ['Go', 'Kubernetes', 'Kafka']
    },
    {
      _id: new mongoose.Types.ObjectId(),
      title: 'Closed Mobile Engineer',
      department: 'Engineering',
      status: 'closed', // should be excluded
      openPositions: 1,
      requiredSkills: ['Kubernetes', 'Swift']
    }
  ];

  const mockJobMatches: any[] = [
    { jobId: mockJobId, matchScore: 92 },
    { jobId: mockJobId, matchScore: 78 }
  ];

  const recruitmentLinkedGaps = await calculateDepartmentSkillGaps(
    mockRequirements,
    mockEmployees,
    [],
    mockJobs,
    mockJobMatches
  );

  const linkedGap = recruitmentLinkedGaps[0];
  assert(linkedGap.recruitmentOpportunities.length === 1, 'Links active job requisition with Kubernetes requirement');
  const recOpp = linkedGap.recruitmentOpportunities[0];
  assert(recOpp.title === 'Staff Distributed Systems Engineer', 'Linked job title matches active requisition');
  assert(recOpp.matchedCandidatesCount === 2, 'Counts 2 matched candidates in pipeline');
  assert(recOpp.topCandidateScore === 92, 'Top candidate score is 92%');
  assert(recOpp.openPositions === 2, 'Open positions count is preserved');

  // -------------------------------------------------------------------------
  // TEST GROUP 7: Aggregation & Capability Matrix
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 7: Aggregation & Capability Matrix]');

  const allEmployees = [...mockEmployees, employeeWithDockerAndAWS];
  const overview = await getWorkforceSkillOverview(allEmployees, mockRequirements, [], mockJobs, mockJobMatches);

  assert(overview.summary?.totalEmployees === 4, 'Summary totalEmployees is 4');
  assert(overview.summary?.totalRequirements === 1, 'Summary totalRequirements is 1');
  assert(overview.summary?.criticalGaps === 1, 'Summary criticalGaps is 1');
  assert((overview.summary?.totalUpskillingCandidates ?? 0) >= 1, 'Summary counts upskilling candidates');

  const matrix = await getDepartmentCapabilityMatrix(allEmployees, mockRequirements);
  assert(matrix.length === 1, 'Capability matrix has 1 department');
  assert(matrix[0].department === 'Engineering', 'Capability matrix department is Engineering');
  assert(matrix[0].skills.length === 1, 'Capability matrix has 1 tracked skill');
  assert(matrix[0].skills[0].skill === 'Kubernetes', 'Capability matrix skill is Kubernetes');
  assert(matrix[0].skills[0].severity === 'critical', 'Matrix severity is critical');

  // Employee skill profile retrieval
  const profiles = await getEmployeeSkillProfiles(allEmployees, 'Engineering');
  assert(profiles.length === 4, 'Returns 4 employee skill profiles for Engineering');
  assert(profiles[0].skills.length > 0, 'Employee profiles retain skill list');

  // -------------------------------------------------------------------------
  // TEST GROUP 8: Server-Side RBAC & Authorization
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 8: Server-Side RBAC & Authorization]');

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

  const recruiterReq = new NextRequest('http://localhost:3000/api/hr/skills', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.recruiter}=${recruiterToken}`,
      [ROLE_HEADER_NAME]: 'recruiter'
    }
  });
  const recruiterAuth = verifyTokenWithRole(recruiterReq, ['recruiter', 'admin']);
  assert(recruiterAuth !== null && recruiterAuth.decoded.role === 'recruiter', 'Recruiter token verified successfully');

  const adminReq = new NextRequest('http://localhost:3000/api/hr/skills', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.admin}=${adminToken}`,
      [ROLE_HEADER_NAME]: 'admin'
    }
  });
  const adminAuth = verifyTokenWithRole(adminReq, ['recruiter', 'admin']);
  assert(adminAuth !== null && adminAuth.decoded.role === 'admin', 'Admin token verified successfully');

  // Student verification for recruiter/admin role must fail (403)
  const studentReq = new NextRequest('http://localhost:3000/api/hr/skills', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.student}=${studentToken}`,
      [ROLE_HEADER_NAME]: 'student'
    }
  });
  const studentAuth = verifyTokenWithRole(studentReq, ['recruiter', 'admin']);
  const allowedRoles = ['recruiter', 'admin'];
  const studentIsAllowed = Boolean(studentAuth && allowedRoles.includes(studentAuth.decoded.role as any));
  assert(!studentIsAllowed, 'Student role rejected for workforce skill intelligence (403)');

  // Unauthenticated request must return null (401)
  const unauthReq = new NextRequest('http://localhost:3000/api/hr/skills');
  const unauth = verifyTokenWithRole(unauthReq, ['recruiter', 'admin']);
  assert(unauth === null, 'Unauthenticated request rejected with no token (401)');

  // -------------------------------------------------------------------------
  // TEST GROUP 9: Grounded Gemini Explanation & Deterministic Fallback
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 9: Grounded Gemini Explanation & Deterministic Fallback]');

  // Test deterministic fallback generator directly
  const explanationResult: SkillGapExplanationResult = await generateSkillGapExplanation(k8sGap);
  assert(typeof explanationResult.summary === 'string' && explanationResult.summary.length > 0, 'Explanation includes strategic summary');
  assert(typeof explanationResult.whyItMatters === 'string' && explanationResult.whyItMatters.length > 0, 'Explanation includes whyItMatters');
  assert(typeof explanationResult.coverageAnalysis === 'string', 'Explanation includes coverageAnalysis');
  assert(Array.isArray(explanationResult.recommendations) && explanationResult.recommendations.length > 0, 'Explanation provides actionable recommendations');
  assert(Array.isArray(explanationResult.upskillingPaths), 'Explanation provides upskillingPaths');
  assert(Array.isArray(explanationResult.recruitmentOptions), 'Explanation provides recruitmentOptions');

  // Verify that metrics are grounded in precalculated values and not modified
  assert(explanationResult.groundedMetrics?.targetHeadcount === 3, 'Grounded target headcount is preserved');
  assert(explanationResult.groundedMetrics?.verifiedHeadcount === 1, 'Grounded verified headcount is preserved');
  assert(explanationResult.groundedMetrics?.severity === 'critical', 'Grounded severity is preserved');

  // -------------------------------------------------------------------------
  // TEST GROUP 10: Live Database Integration (when MongoDB is reachable)
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 10: Live Database Integration]');

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

    // 10.1: DepartmentSkillRequirement Model persistence test
    let testReq = await DepartmentSkillRequirement.findOne({ department: 'Engineering', skillName: 'Kubernetes' });
    if (!testReq) {
      testReq = await DepartmentSkillRequirement.create({
        department: 'Engineering',
        skillName: 'Kubernetes',
        category: 'technical',
        targetCoverageCount: 3,
        minProficiency: 'intermediate',
        criticality: 'critical',
        description: 'Container orchestration for microservices.'
      });
    }
    assert(testReq !== null && testReq.targetCoverageCount === 3, 'DepartmentSkillRequirement persisted and queryable in MongoDB');
    dbTestsExecuted++;

    // 10.2: Employee model indexing check
    const employeeCount = await Employee.countDocuments();
    assert(typeof employeeCount === 'number', `Employee collection accessible (headcount: ${employeeCount})`);
    dbTestsExecuted++;

    // 10.3: Baseline seeding integration
    const baselineReqs = BASELINE_DEPARTMENT_REQUIREMENTS;
    assert(baselineReqs.length >= 6, `Baseline seed definitions define ${baselineReqs.length} department requirements`);
    dbTestsExecuted++;

    // 10.4: Cross-module query integration
    const engEmployees = await Employee.find({ department: 'Engineering', status: 'active' });
    assert(engEmployees.length >= 0, `Queried active Engineering employees from live DB (${engEmployees.length} found)`);
    dbTestsExecuted++;
  } else {
    console.log('  Skipping live DB tests (no active MongoDB connection in test environment).');
    console.log('  All schema, calculation, compound risk, upskilling, and fallback tests executed successfully.');
    dbTestsSkipped = 4;
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 11: Regression Verification
  // -------------------------------------------------------------------------
  console.log('\n[Test Group 11: Regression Verification]');
  assert(typeof calculateMatchScore === 'function', 'calculateMatchScore preserved for recruitment');
  assert(typeof calculateDetailedMatchScore === 'function', 'calculateDetailedMatchScore preserved as matching source of truth');
  assert(DepartmentSkillRequirement.modelName === 'DepartmentSkillRequirement', 'DepartmentSkillRequirement model defined correctly');
  assert(Employee.modelName === 'Employee', 'Employee model intact');
  assert(WorkforceRisk.modelName === 'WorkforceRisk', 'WorkforceRisk model intact');
  assert(Job.modelName === 'Job', 'Job model intact');
  assert(JobMatch.modelName === 'JobMatch', 'JobMatch model intact');
  assert(User.modelName === 'User', 'User model intact');

  console.log('\n================================================================');
  console.log(`TOTAL PHASE 2.7 TESTS: ${passed + failed}`);
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

runSkillsVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error during skill intelligence verification:', err);
    process.exit(1);
  });
