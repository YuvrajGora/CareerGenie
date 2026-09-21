import Employee from '../src/models/Employee';
import EmployeeSignal from '../src/models/EmployeeSignal';
import WorkforceRisk from '../src/models/WorkforceRisk';
import PolicyDocument from '../src/models/PolicyDocument';
import OnboardingPlan from '../src/models/OnboardingPlan';
import InterviewEvaluation from '../src/models/InterviewEvaluation';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runDataFoundationTests() {
  console.log('====================================================');
  console.log('  Phase 2.1: HR Data Foundation Verification Tests  ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  console.log('[Test 1: Model Registration & Interface Completeness]');
  // ---------------------------------------------------------------
  assert(typeof Employee.modelName === 'string' && Employee.modelName === 'Employee', 'Employee model is properly registered');
  assert(typeof EmployeeSignal.modelName === 'string' && EmployeeSignal.modelName === 'EmployeeSignal', 'EmployeeSignal model is properly registered');
  assert(typeof WorkforceRisk.modelName === 'string' && WorkforceRisk.modelName === 'WorkforceRisk', 'WorkforceRisk model is properly registered');
  assert(typeof PolicyDocument.modelName === 'string' && PolicyDocument.modelName === 'PolicyDocument', 'PolicyDocument model is properly registered');
  assert(typeof OnboardingPlan.modelName === 'string' && OnboardingPlan.modelName === 'OnboardingPlan', 'OnboardingPlan model is properly registered');
  assert(typeof InterviewEvaluation.modelName === 'string' && InterviewEvaluation.modelName === 'InterviewEvaluation', 'InterviewEvaluation model is properly registered');

  // ---------------------------------------------------------------
  console.log('\n[Test 2: Schema Validation & Enum Enforcement - Employee]');
  // ---------------------------------------------------------------
  const validEmployee = new Employee({
    employeeCode: 'EMP-9999',
    name: 'Test Engineer',
    email: 'test.engineer@careergenie.internal',
    department: 'Engineering',
    roleTitle: 'Software Engineer',
    level: 'Mid-Level',
    location: 'Remote',
    joiningDate: new Date(),
    salary: 120000,
    status: 'active',
    skills: [{ name: 'TypeScript', proficiency: 'expert', category: 'technical', verified: true }]
  });
  const valErr1 = validEmployee.validateSync();
  assert(!valErr1, 'Valid Employee document passes schema validation');

  const invalidDeptEmployee = new Employee({
    employeeCode: 'EMP-9998',
    name: 'Invalid Dept',
    email: 'invalid.dept@careergenie.internal',
    department: 'NonExistentDept', // Invalid enum
    roleTitle: 'Engineer',
    joiningDate: new Date(),
    salary: 100000
  });
  const valErr2 = invalidDeptEmployee.validateSync();
  assert(!!valErr2 && !!valErr2.errors.department, 'Rejects invalid department enum value');

  const invalidLevelEmployee = new Employee({
    employeeCode: 'EMP-9997',
    name: 'Invalid Level',
    email: 'invalid.level@careergenie.internal',
    department: 'Engineering',
    roleTitle: 'Engineer',
    level: 'GrandMaster', // Invalid enum
    joiningDate: new Date(),
    salary: 100000
  });
  const valErr3 = invalidLevelEmployee.validateSync();
  assert(!!valErr3 && !!valErr3.errors.level, 'Rejects invalid employee level enum value');

  // ---------------------------------------------------------------
  console.log('\n[Test 3: Schema Validation - EmployeeSignal]');
  // ---------------------------------------------------------------
  const validSignal = new EmployeeSignal({
    employeeId: validEmployee._id,
    type: 'performance',
    metric: 'okr_achievement_pct',
    value: 95,
    period: '2026-Q1'
  });
  const sigErr1 = validSignal.validateSync();
  assert(!sigErr1, 'Valid EmployeeSignal document passes validation');

  const invalidSignalType = new EmployeeSignal({
    employeeId: validEmployee._id,
    type: 'invalid_type', // Invalid
    metric: 'test_metric',
    value: 50,
    period: '2026-Q1'
  });
  const sigErr2 = invalidSignalType.validateSync();
  assert(!!sigErr2 && !!sigErr2.errors.type, 'Rejects invalid signal type enum');

  // ---------------------------------------------------------------
  console.log('\n[Test 4: Schema Validation - WorkforceRisk]');
  // ---------------------------------------------------------------
  const validRisk = new WorkforceRisk({
    employeeId: validEmployee._id,
    riskType: 'burnout',
    severity: 'critical',
    score: 88,
    aiExplanation: 'Extreme weekly overtime and dropping eNPS pulse score.',
    evidence: [{
      signalType: 'workload',
      metric: 'weekly_overtime_hours',
      observedValue: '18.5 hrs',
      benchmark: '3.5 hrs',
      significance: 'high'
    }],
    recommendedActions: [{
      actionId: 'ACT-01',
      title: 'Workload Rebalancing',
      rationale: 'Reassign on-call load',
      urgency: 'immediate'
    }]
  });
  const riskErr1 = validRisk.validateSync();
  assert(!riskErr1, 'Valid WorkforceRisk document passes validation');

  const invalidSeverityRisk = new WorkforceRisk({
    employeeId: validEmployee._id,
    riskType: 'attrition',
    severity: 'catastrophic', // Invalid
    score: 99,
    aiExplanation: 'Explanation'
  });
  const riskErr2 = invalidSeverityRisk.validateSync();
  assert(!!riskErr2 && !!riskErr2.errors.severity, 'Rejects invalid risk severity enum');

  // ---------------------------------------------------------------
  console.log('\n[Test 5: Schema Validation - PolicyDocument]');
  // ---------------------------------------------------------------
  const validPolicy = new PolicyDocument({
    policyCode: 'POL-TEST-01',
    title: 'Test Workplace Policy',
    category: 'remote_work',
    summary: 'Summary of test policy',
    content: 'Full markdown content',
    effectiveDate: new Date(),
    sections: [{
      sectionId: 'SEC-1.1',
      title: 'Core Hours',
      content: '10 AM to 3 PM',
      keywords: ['core', 'hours']
    }]
  });
  const polErr1 = validPolicy.validateSync();
  assert(!polErr1, 'Valid PolicyDocument passes validation');

  // ---------------------------------------------------------------
  console.log('\n[Test 6: Schema Validation - OnboardingPlan & InterviewEvaluation]');
  // ---------------------------------------------------------------
  const validOnboarding = new OnboardingPlan({
    employeeId: validEmployee._id,
    roleTitle: 'Mid-Level Frontend Engineer',
    department: 'Engineering',
    startDate: new Date(),
    targetCompletionDate: new Date(),
    overallProgress: 50,
    status: 'on_track',
    milestones: [{
      milestoneId: 'M-01',
      title: 'SSO Configuration',
      description: 'Setup accounts',
      category: 'technical_setup',
      dueDay: 1,
      completed: true
    }]
  });
  const onbErr = validOnboarding.validateSync();
  assert(!onbErr, 'Valid OnboardingPlan passes validation');

  const validEvaluation = new InterviewEvaluation({
    jobId: validEmployee._id,
    candidateId: validEmployee._id,
    candidateName: 'Test Candidate',
    roleTitle: 'Staff Engineer',
    interviewerName: 'Tech Lead',
    interviewStage: 'technical',
    overallScore: 85,
    recommendation: 'strong_hire',
    competencies: [{
      competency: 'System Architecture',
      score: 5,
      weight: 0.5,
      feedback: 'Excellent grasp of CAP theorem trade-offs',
      keySignals: ['Distributed consensus']
    }]
  });
  const evalErr = validEvaluation.validateSync();
  assert(!evalErr, 'Valid InterviewEvaluation passes validation');

  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Phase 2.1 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runDataFoundationTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
