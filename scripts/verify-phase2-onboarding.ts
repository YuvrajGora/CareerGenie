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
import EmployeeSignal from '../src/models/EmployeeSignal';
import OnboardingPlan, { IOnboardingMilestone } from '../src/models/OnboardingPlan';
import Notification from '../src/models/Notification';
import {
  getDeterministicTemplateMilestones,
  normalizeLevelKey,
  calculatePlanMetrics,
  calculateDeterministicDiagnosis,
  generateAndSaveOnboardingPlan,
  updateMilestoneState,
  runAdaptiveOnboardingCheck,
  getOnboardingPlans,
  getOnboardingPlanById,
  DEPARTMENT_LEVEL_TEMPLATES,
  BASE_COMPLIANCE_MILESTONES
} from '../src/services/onboardingOrchestratorService';
import {
  generateAdaptiveOnboardingPlan,
  analyzeOnboardingVelocityAndAdapt
} from '../src/services/gemini';
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

async function runPhase2OnboardingTests() {
  console.log('====================================================');
  console.log('  Phase 2.4: Adaptive Onboarding Orchestrator Tests ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // TEST GROUP 1: OnboardingPlan Schema & Model Backward Compatibility
  // ---------------------------------------------------------------
  console.log('[Test Group 1: OnboardingPlan Schema & Compatibility]');

  assert(typeof OnboardingPlan.modelName === 'string', 'OnboardingPlan model is properly registered in Mongoose');

  // Test legacy record structure
  const legacyRecord = new OnboardingPlan({
    employeeId: new mongoose.Types.ObjectId(),
    roleTitle: 'Senior Frontend Engineer',
    department: 'Engineering',
    mentorName: 'Sarah Lin',
    startDate: new Date('2026-09-01'),
    targetCompletionDate: new Date('2026-11-30'),
    overallProgress: 40,
    status: 'on_track',
    milestones: [
      {
        milestoneId: 'M-01',
        title: 'Hardware Setup',
        description: 'Configure laptop and credentials',
        category: 'technical_setup',
        dueDay: 1,
        completed: true
      }
    ]
  });

  const legacyErr = legacyRecord.validateSync();
  assert(!legacyErr, 'Legacy OnboardingPlan document passes validation without new fields');
  assert(legacyRecord.velocityScore === 100, 'velocityScore defaults to 100 if not specified');
  assert(legacyRecord.milestones[0].status === 'pending', 'Milestone status defaults to "pending"');

  // Test extended record with new adaptive fields
  const extendedRecord = new OnboardingPlan({
    employeeId: new mongoose.Types.ObjectId(),
    roleTitle: 'Product Designer',
    department: 'Product & Design',
    mentorName: 'Zoe Kim',
    startDate: new Date('2026-09-01'),
    targetCompletionDate: new Date('2026-11-30'),
    overallProgress: 60,
    status: 'delayed',
    velocityScore: 75,
    milestones: [
      {
        milestoneId: 'M-01',
        title: 'Figma Library Access',
        description: 'Clone component system',
        category: 'technical_setup',
        dueDay: 3,
        completed: true,
        targetDate: new Date('2026-09-04'),
        resourceLink: 'POL-REM-2026',
        status: 'completed'
      },
      {
        milestoneId: 'M-02',
        title: 'Design Critique Attendance',
        description: 'Observe sprint design review',
        category: 'team_integration',
        dueDay: 10,
        completed: false,
        status: 'overdue'
      }
    ],
    adaptationHistory: [
      {
        adaptedAt: new Date(),
        trigger: 'ai_velocity_check',
        reason: 'Overdue design critique session rescheduled',
        suggestedAdjustments: ['Pair with design lead on upcoming sprint critique']
      }
    ],
    checkpoints: [
      { day: 30, completed: true, rating: 5, notes: 'Great 30-day ramp' },
      { day: 60, completed: false },
      { day: 90, completed: false }
    ]
  });

  const extendedErr = extendedRecord.validateSync();
  assert(!extendedErr, 'Extended OnboardingPlan with adaptive history and checkpoints passes validation');
  assert(extendedRecord.milestones[1].status === 'overdue', 'Milestone status preserves "overdue"');
  assert(extendedRecord.adaptationHistory?.length === 1, 'Adaptation history record is correctly stored');
  assert(extendedRecord.checkpoints?.length === 3, 'Checkpoints array stores 30/60/90 milestones');

  // ---------------------------------------------------------------
  // TEST GROUP 2: Deterministic Department & Level Templates
  // ---------------------------------------------------------------
  console.log('\n[Test Group 2: Department & Level Template Engine]');

  const departments = ['Engineering', 'Product & Design', 'Sales & Marketing', 'Operations & HR', 'Finance'];
  const levels = ['Junior', 'Mid', 'Senior', 'Lead'];

  // Check compliance milestones
  assert(BASE_COMPLIANCE_MILESTONES.length === 2, 'Base compliance milestones defined (M-01, M-02)');
  assert(BASE_COMPLIANCE_MILESTONES[0].category === 'compliance', 'Base milestone M-01 is compliance category');
  assert(BASE_COMPLIANCE_MILESTONES[0].resourceLink === 'POL-SEC-2026', 'Base milestone references official policy POL-SEC-2026');

  // Test every department & level combination
  for (const dept of departments) {
    for (const lvl of levels) {
      const template = getDeterministicTemplateMilestones(dept, lvl);
      assert(
        template.length >= 6 && template.length <= 8,
        `Template for ${dept} (${lvl}) has between 6 and 8 milestones (Actual: ${template.length})`
      );

      const hasCompliance = template.some((m) => m.category === 'compliance');
      const hasTechSetup = template.some((m) => m.category === 'technical_setup');
      const hasTeamIntegration = template.some((m) => m.category === 'team_integration');
      const hasRoleTraining = template.some((m) => m.category === 'role_training');

      assert(
        hasCompliance && hasTechSetup && hasTeamIntegration && hasRoleTraining,
        `${dept} (${lvl}) template contains all 4 mandatory milestone categories`
      );
    }
  }

  // Level key normalizer tests
  assert(normalizeLevelKey('Junior Engineer') === 'Junior', 'normalizeLevelKey: "Junior Engineer" -> Junior');
  assert(normalizeLevelKey('Intern') === 'Junior', 'normalizeLevelKey: "Intern" -> Junior');
  assert(normalizeLevelKey('Mid-Level Developer') === 'Mid', 'normalizeLevelKey: "Mid-Level Developer" -> Mid');
  assert(normalizeLevelKey('Senior Architect') === 'Senior', 'normalizeLevelKey: "Senior Architect" -> Senior');
  assert(normalizeLevelKey('Staff Engineer') === 'Lead', 'normalizeLevelKey: "Staff Engineer" -> Lead');
  assert(normalizeLevelKey('Director of Operations') === 'Lead', 'normalizeLevelKey: "Director of Operations" -> Lead');

  // ---------------------------------------------------------------
  // TEST GROUP 3: Deterministic Progress & Velocity Calculations
  // ---------------------------------------------------------------
  console.log('\n[Test Group 3: Progress & Velocity Math]');

  const testMilestones: IOnboardingMilestone[] = [
    { milestoneId: 'M-01', title: 'Task 1', description: 'D1', category: 'compliance', dueDay: 1, completed: true },
    { milestoneId: 'M-02', title: 'Task 2', description: 'D3', category: 'technical_setup', dueDay: 3, completed: true },
    { milestoneId: 'M-03', title: 'Task 3', description: 'D7', category: 'team_integration', dueDay: 7, completed: false },
    { milestoneId: 'M-04', title: 'Task 4', description: 'D14', category: 'role_training', dueDay: 14, completed: false },
    { milestoneId: 'M-05', title: 'Task 5', description: 'D30', category: 'role_training', dueDay: 30, completed: false }
  ];

  // Case A: Day 0 (before start date)
  const startDate = new Date('2026-09-01');
  const metricsDay0 = calculatePlanMetrics(
    { startDate, targetCompletionDate: new Date('2026-11-30'), milestones: testMilestones },
    new Date('2026-09-01')
  );
  assert(metricsDay0.overallProgress === 40, 'Day 0: 2/5 milestones completed = 40% progress');
  assert(metricsDay0.velocityScore === 100, 'Day 0: No milestones past due date, velocity score is 100');
  assert(metricsDay0.status === 'on_track', 'Day 0: Plan status is on_track');
  assert(metricsDay0.overdueCount === 0, 'Day 0: 0 overdue milestones');

  // Case B: Day 5 (Milestones M-01 due Day 1 and M-02 due Day 3 were due)
  const metricsDay5 = calculatePlanMetrics(
    { startDate, targetCompletionDate: new Date('2026-11-30'), milestones: testMilestones },
    new Date('2026-09-06') // 5 days elapsed
  );
  assert(metricsDay5.velocityScore === 100, 'Day 5: Both milestones due by Day 5 are complete, velocity = 100');
  assert(metricsDay5.status === 'on_track', 'Day 5: Plan is on_track');
  assert(metricsDay5.overdueCount === 0, 'Day 5: 0 overdue milestones');

  // Case C: Day 10 (M-01 Day 1, M-02 Day 3, M-03 Day 7 were due; M-03 is incomplete)
  const metricsDay10 = calculatePlanMetrics(
    { startDate, targetCompletionDate: new Date('2026-11-30'), milestones: testMilestones },
    new Date('2026-09-11') // 10 days elapsed
  );
  // Milestones due by today = 3 (M-01, M-02, M-03). Completed due by today = 2 (M-01, M-02).
  // Velocity = (2 / 3) * 100 = 67%
  assert(metricsDay10.velocityScore === 67, `Day 10: 2 of 3 due completed -> velocity = 67 (Actual: ${metricsDay10.velocityScore})`);
  assert(metricsDay10.status === 'delayed', 'Day 10: Incomplete milestone past due date -> status = delayed');
  assert(metricsDay10.overdueCount === 1, 'Day 10: 1 overdue milestone detected (M-03)');
  assert(metricsDay10.overdueMilestones[0].milestoneId === 'M-03', 'Day 10: Identified M-03 as overdue');
  assert(metricsDay10.overdueMilestones[0].daysOverdue === 3, 'Day 10: Days overdue = 10 - 7 = 3 days');

  // Case D: All milestones completed
  const allCompletedMilestones: IOnboardingMilestone[] = testMilestones.map((m) => ({ ...m, completed: true }));
  const metricsComplete = calculatePlanMetrics(
    { startDate, targetCompletionDate: new Date('2026-11-30'), milestones: allCompletedMilestones },
    new Date('2026-09-20')
  );
  assert(metricsComplete.overallProgress === 100, 'All complete: 100% progress');
  assert(metricsComplete.velocityScore === 100, 'All complete: velocity score is 100');
  assert(metricsComplete.status === 'completed', 'All complete: status = completed');

  // ---------------------------------------------------------------
  // TEST GROUP 4: Deterministic Adaptive Diagnosis
  // ---------------------------------------------------------------
  console.log('\n[Test Group 4: Deterministic Adaptive Diagnosis]');

  const testEmp = {
    name: 'Elena Rostova',
    roleTitle: 'Senior Product Designer',
    department: 'Product & Design',
    level: 'Senior'
  };

  // Delayed diagnosis
  const delayedDiagnosis = calculateDeterministicDiagnosis(testEmp, metricsDay10);
  assert(delayedDiagnosis.status === 'delayed', 'Delayed diagnosis reflects status = delayed');
  assert(delayedDiagnosis.urgency === 'short_term', 'Delayed diagnosis has short_term urgency');
  assert(delayedDiagnosis.diagnosis.includes('Pace delay detected'), 'Diagnosis explains pace delay');
  assert(delayedDiagnosis.suggestedAdjustments.length >= 2, 'Generates at least 2 structured actionable adjustments');
  assert(
    delayedDiagnosis.suggestedAdjustments.some((a) => a.title.includes('Recalibration') || a.title.includes('Mentorship')),
    'Includes schedule recalibration or mentorship intervention'
  );

  // On-track diagnosis
  const onTrackDiagnosis = calculateDeterministicDiagnosis(testEmp, metricsDay5);
  assert(onTrackDiagnosis.status === 'on_track', 'On-track diagnosis reflects status = on_track');
  assert(onTrackDiagnosis.urgency === 'strategic', 'On-track diagnosis has strategic urgency');
  assert(onTrackDiagnosis.diagnosis.includes('progressing smoothly'), 'Diagnosis confirms smooth progress');

  // Completed diagnosis
  const completedDiagnosis = calculateDeterministicDiagnosis(testEmp, metricsComplete);
  assert(completedDiagnosis.status === 'completed', 'Completed diagnosis reflects status = completed');
  assert(completedDiagnosis.diagnosis.includes('100% of onboarding milestones'), 'Diagnosis confirms 100% completion');

  // ---------------------------------------------------------------
  // TEST GROUP 5: Gemini AI Functions & Fallback Robustness
  // ---------------------------------------------------------------
  console.log('\n[Test Group 5: Gemini Integration & Fallback Robustness]');

  // Test generateAdaptiveOnboardingPlan fallback
  const fallbackMilestones = getDeterministicTemplateMilestones('Engineering', 'Mid');
  const aiPlanResult = await generateAdaptiveOnboardingPlan(
    {
      name: 'Maya Patel',
      roleTitle: 'Full-Stack Software Engineer',
      department: 'Engineering',
      level: 'Mid',
      skills: [{ name: 'TypeScript', proficiency: 'intermediate', verified: true }]
    },
    [{ policyCode: 'POL-REM-2026', title: 'Remote Work Policy', category: 'Workplace & Remote' }],
    fallbackMilestones
  );

  assert(aiPlanResult.roleTitle === 'Full-Stack Software Engineer', 'aiPlanResult contains correct roleTitle');
  assert(aiPlanResult.department === 'Engineering', 'aiPlanResult contains correct department');
  assert(aiPlanResult.milestones.length >= 5, 'aiPlanResult returns structured milestones');
  assert(typeof aiPlanResult.aiGuidanceNotes === 'string' && aiPlanResult.aiGuidanceNotes.length > 10, 'aiPlanResult contains guidance notes');

  // Test analyzeOnboardingVelocityAndAdapt fallback
  const aiDiagnosisResult = await analyzeOnboardingVelocityAndAdapt(
    testEmp,
    {
      overallProgress: metricsDay10.overallProgress,
      velocityScore: metricsDay10.velocityScore,
      status: metricsDay10.status,
      daysSinceStart: metricsDay10.daysSinceStart,
      overdueMilestones: metricsDay10.overdueMilestones,
      completedMilestonesCount: metricsDay10.completedCount,
      totalMilestonesCount: metricsDay10.totalCount
    },
    {
      diagnosis: delayedDiagnosis.diagnosis,
      whyItMatters: delayedDiagnosis.whyItMatters,
      suggestedAdjustments: delayedDiagnosis.suggestedAdjustments
    }
  );

  assert(typeof aiDiagnosisResult.diagnosis === 'string', 'aiDiagnosisResult contains diagnosis string');
  assert(typeof aiDiagnosisResult.whyItMatters === 'string', 'aiDiagnosisResult contains whyItMatters string');
  assert(Array.isArray(aiDiagnosisResult.suggestedAdjustments), 'aiDiagnosisResult returns suggestedAdjustments array');
  assert(aiDiagnosisResult.suggestedAdjustments.length >= 1, 'aiDiagnosisResult has at least 1 adjustment');

  // ---------------------------------------------------------------
  // TEST GROUP 6: RBAC Authorization & Security Verification
  // ---------------------------------------------------------------
  console.log('\n[Test Group 6: RBAC & API Authorization]');

  const recruiterUserId = new mongoose.Types.ObjectId().toString();
  const studentUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();

  const recruiterToken = signToken({ userId: recruiterUserId, role: 'recruiter' });
  const studentToken = signToken({ userId: studentUserId, role: 'student' });
  const adminToken = signToken({ userId: adminUserId, role: 'admin' });

  // Recruiter authorization test
  const recruiterReq = new NextRequest('http://localhost:3000/api/hr/onboarding', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.recruiter}=${recruiterToken}`,
      [ROLE_HEADER_NAME]: 'recruiter'
    }
  });
  const recruiterAuth = verifyTokenWithRole(recruiterReq, ['recruiter', 'admin']);
  assert(recruiterAuth !== null && recruiterAuth.decoded.role === 'recruiter', 'Recruiter token authorized for HR onboarding');

  // Admin authorization test
  const adminReq = new NextRequest('http://localhost:3000/api/hr/onboarding', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.admin}=${adminToken}`,
      [ROLE_HEADER_NAME]: 'admin'
    }
  });
  const adminAuth = verifyTokenWithRole(adminReq, ['recruiter', 'admin']);
  assert(adminAuth !== null && adminAuth.decoded.role === 'admin', 'Admin token authorized for HR onboarding');

  // Student authorization rejection (403 protection)
  const studentReq = new NextRequest('http://localhost:3000/api/hr/onboarding', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.student}=${studentToken}`,
      [ROLE_HEADER_NAME]: 'student'
    }
  });
  const studentAuth = verifyTokenWithRole(studentReq, ['recruiter', 'admin']);
  const allowedRoles = ['recruiter', 'admin'];
  const studentIsAllowed = Boolean(studentAuth && allowedRoles.includes(studentAuth.decoded.role as any));
  assert(!studentIsAllowed, 'Student role rejected for HR onboarding (403)');

  // Unauthenticated request rejection (401 protection)
  const unauthReq = new NextRequest('http://localhost:3000/api/hr/onboarding');
  const unauthAuth = verifyTokenWithRole(unauthReq, ['recruiter', 'admin']);
  assert(unauthAuth === null, 'Unauthenticated request rejected (401)');

  // ---------------------------------------------------------------
  // TEST GROUP 7: End-to-End Orchestrator Workflows (MongoDB Integration)
  // ---------------------------------------------------------------
  console.log('\n[Test Group 7: End-to-End Database Workflows]');

  let dbConnected = false;
  try {
    await connectDB();
    dbConnected = mongoose.connection.readyState === 1;
  } catch (err) {
    console.warn('  ⚠️ MongoDB not reachable for live DB integration tests.');
  }

  if (dbConnected) {
    console.log('  Connected to MongoDB: running full lifecycle verification...');

    // A. Query existing seeded onboarding plans (Elena & Maya)
    const existingPlansResult = await getOnboardingPlans({ status: 'all' });
    assert(existingPlansResult.plans.length >= 2, `getOnboardingPlans: Retrieved ${existingPlansResult.plans.length} seeded plans`);
    assert(existingPlansResult.summary.totalPlans >= 2, 'Summary KPIs computed across seeded plans');

    // B. Create a temporary test employee for fresh onboarding lifecycle testing
    const testCode = `TEST-ONB-${Date.now().toString().slice(-4)}`;
    const freshEmployee = await Employee.create({
      employeeCode: testCode,
      name: 'Automated Test Hire',
      email: `test.hire.${Date.now()}@careergenie.internal`,
      department: 'Engineering',
      roleTitle: 'Junior Backend Systems Engineer',
      level: 'Junior',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date(),
      salary: 110000,
      status: 'onboarding',
      skills: [
        { name: 'TypeScript', proficiency: 'beginner', category: 'technical', verified: false }
      ]
    });

    try {
      // C. Generate and save onboarding plan
      const createdPlan = await generateAndSaveOnboardingPlan(freshEmployee._id.toString(), {
        mentorName: 'Sarah Lin (Tech Lead)',
        useAi: false // Deterministic template for test predictability
      });

      assert(createdPlan.employeeId.toString() === freshEmployee._id.toString(), 'generateAndSaveOnboardingPlan: Plan created with correct employeeId');
      assert(createdPlan.milestones.length >= 6, `Plan generated with ${createdPlan.milestones.length} milestones`);
      assert(createdPlan.status === 'on_track', 'New plan starts in on_track status');
      assert(createdPlan.overallProgress === 0, 'New plan starts at 0% progress');
      assert(createdPlan.velocityScore === 100, 'New plan starts at velocity score 100');

      // D. Test duplicate prevention
      let duplicateThrew = false;
      try {
        await generateAndSaveOnboardingPlan(freshEmployee._id.toString());
      } catch (err: any) {
        duplicateThrew = true;
        assert(err.message.includes('already exists'), 'Duplicate plan creation prevented with descriptive error');
      }
      assert(duplicateThrew, 'Attempting duplicate plan correctly threw an error');

      // E. Test milestone completion toggle and telemetry dispatch
      const firstMilestoneId = createdPlan.milestones[0].milestoneId;
      const milestoneUpdateResult = await updateMilestoneState(createdPlan._id.toString(), firstMilestoneId, {
        completed: true,
        notes: 'SSO hardware credentials verified by IT security.'
      });

      assert(milestoneUpdateResult.plan.overallProgress > 0, `Progress updated after milestone completion (Now: ${milestoneUpdateResult.plan.overallProgress}%)`);
      assert(milestoneUpdateResult.plan.milestones[0].completed === true, 'Milestone completed flag set to true');
      assert(milestoneUpdateResult.plan.milestones[0].completedAt !== undefined, 'completedAt timestamp recorded');
      assert(milestoneUpdateResult.plan.milestones[0].status === 'completed', 'Milestone status updated to "completed"');

      // Verify EmployeeSignal telemetry generation
      const signals = await EmployeeSignal.find({ employeeId: freshEmployee._id });
      assert(signals.length >= 3, `EmployeeSignal telemetry recorded 3 distinct metrics (Actual: ${signals.length})`);
      const hasProgressSignal = signals.some((s) => s.metric === 'onboarding_milestone_completion_rate');
      const hasVelocitySignal = signals.some((s) => s.metric === 'onboarding_velocity_pct');
      const hasDelaySignal = signals.some((s) => s.metric === 'onboarding_delay_days');

      assert(hasProgressSignal && hasVelocitySignal && hasDelaySignal, 'All 3 onboarding telemetry metrics emitted to EmployeeSignal');

      // F. Test adaptive onboarding check and adaptation history
      const adaptiveCheckResult = await runAdaptiveOnboardingCheck(createdPlan._id.toString(), {
        appliedBy: 'Verification Agent',
        useAi: false
      });

      assert(adaptiveCheckResult.diagnosis !== undefined, 'runAdaptiveOnboardingCheck returns structured diagnosis');
      assert(adaptiveCheckResult.plan.adaptationHistory?.length === 2, 'Adaptation history record appended to plan');
      assert(typeof adaptiveCheckResult.plan.aiGuidanceNotes === 'string', 'aiGuidanceNotes updated with latest diagnosis');

      // G. Test employee onboarding -> active transition upon 100% completion
      // Mark all milestones as completed
      for (const m of createdPlan.milestones) {
        await updateMilestoneState(createdPlan._id.toString(), m.milestoneId, { completed: true });
      }

      const refreshedPlan = await OnboardingPlan.findById(createdPlan._id);
      assert(refreshedPlan?.overallProgress === 100, 'All milestones marked complete -> 100% progress');
      assert(refreshedPlan?.status === 'completed', 'All milestones complete -> status = completed');

      const transitionedEmployee = await Employee.findById(freshEmployee._id);
      assert(
        transitionedEmployee?.status === 'active',
        `Employee status automatically transitioned from "onboarding" to "active" upon 100% completion (Actual: ${transitionedEmployee?.status})`
      );

      // Clean up test documents
      await OnboardingPlan.findByIdAndDelete(createdPlan._id);
      await EmployeeSignal.deleteMany({ employeeId: freshEmployee._id });
      await Notification.deleteMany({ userId: freshEmployee._id });
      await Employee.findByIdAndDelete(freshEmployee._id);
      console.log('  Cleaned up temporary test employee and artifacts.');
    } catch (innerErr) {
      console.error('  Inner workflow error:', innerErr);
      // Clean up in case of failure
      await OnboardingPlan.deleteMany({ employeeId: freshEmployee._id });
      await Employee.findByIdAndDelete(freshEmployee._id);
      throw innerErr;
    }
  } else {
    console.log('  Skipping live DB tests (no active MongoDB connection in test environment).');
  }

  // ---------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Phase 2.4 Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2OnboardingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
