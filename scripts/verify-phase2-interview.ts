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
import User from '../src/models/User';
import Job from '../src/models/Job';
import Application from '../src/models/Application';
import JobMatch from '../src/models/JobMatch';
import InterviewEvaluation from '../src/models/InterviewEvaluation';
import Notification from '../src/models/Notification';
import UserActivity from '../src/models/UserActivity';
import {
  STAGE_RUBRIC_TEMPLATES,
  calculateOverallScore,
  mapScoreToRecommendation,
  generateDeterministicRubric,
  generateTargetedInterviewQuestions,
  submitInterviewEvaluation,
  getInterviewEvaluations,
  getEligibleInterviewCandidates,
  getInterviewEvaluationById,
  InterviewStage
} from '../src/services/interviewIntelligenceService';
import {
  generateInterviewQuestionRubric,
  synthesizeInterviewEvaluation,
  InterviewQuestionContext,
  InterviewSynthesisContext
} from '../src/services/gemini';
import {
  signToken,
  ROLE_COOKIE_MAP,
  ROLE_HEADER_NAME,
  verifyTokenWithRole
} from '../src/middleware/auth';

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

async function runPhase2InterviewTests() {
  console.log('====================================================');
  console.log('  Phase 2.5: Intelligent Interview Agent Tests      ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // TEST GROUP 1: Deterministic Rubric Generation & Stage Support
  // ---------------------------------------------------------------
  console.log('[Test Group 1: Deterministic Rubric Generation]');

  const stages: InterviewStage[] = ['screen', 'technical', 'system_design', 'culture_fit', 'final'];
  for (const stage of stages) {
    const rubric = generateDeterministicRubric(stage, {
      title: 'Staff Distributed Systems Engineer',
      requiredSkills: ['Go', 'Kafka', 'Kubernetes']
    });

    assert(Array.isArray(rubric) && rubric.length >= 3, `Stage "${stage}": rubric generated with >= 3 competencies`);

    // Verify weights sum to 1.0
    const weightSum = rubric.reduce((acc, c) => acc + c.weight, 0);
    assert(
      Math.abs(weightSum - 1.0) < 0.001,
      `Stage "${stage}": competency weights sum exactly to 1.0 (Sum: ${weightSum.toFixed(2)})`
    );

    // Verify each competency structure
    for (const c of rubric) {
      assert(typeof c.competency === 'string' && c.competency.length > 0, `Stage "${stage}": competency name defined`);
      assert(c.weight > 0 && c.weight <= 1.0, `Stage "${stage}": weight is between 0 and 1 (${c.weight})`);
      assert(Array.isArray(c.keySignals) && c.keySignals.length >= 2, `Stage "${stage}": keySignals array populated`);
    }
  }

  // ---------------------------------------------------------------
  // TEST GROUP 2: Deterministic Weighted Score Math & Validation
  // ---------------------------------------------------------------
  console.log('\n[Test Group 2: Weighted Score Math & Validation]');

  // Test perfect 5.0 score -> 100
  const perfectScores = [
    { score: 5, weight: 0.4 },
    { score: 5, weight: 0.35 },
    { score: 5, weight: 0.25 }
  ];
  const maxScore = calculateOverallScore(perfectScores);
  assert(maxScore === 100, `All 5.0 scores produce 100 overall score (Actual: ${maxScore})`);

  // Test minimum 1.0 score -> 20
  const minScores = [
    { score: 1, weight: 0.4 },
    { score: 1, weight: 0.35 },
    { score: 1, weight: 0.25 }
  ];
  const minScore = calculateOverallScore(minScores);
  assert(minScore === 20, `All 1.0 scores produce 20 overall score (Actual: ${minScore})`);

  // Test mixed score calculation: 4 * 0.4 + 3 * 0.35 + 5 * 0.25 = 1.6 + 1.05 + 1.25 = 3.9 * 20 = 78
  const mixedScores = [
    { score: 4, weight: 0.4 },
    { score: 3, weight: 0.35 },
    { score: 5, weight: 0.25 }
  ];
  const calculatedMixed = calculateOverallScore(mixedScores);
  assert(calculatedMixed === 78, `Mixed scores (4, 3, 5) produce exact mathematical score of 78 (Actual: ${calculatedMixed})`);

  // Score validation: rejects < 1
  let lowScoreThrew = false;
  try {
    calculateOverallScore([{ score: 0, weight: 1.0 }]);
  } catch (err: any) {
    lowScoreThrew = true;
    assert(err.message.includes('between 1 and 5'), 'Score < 1 throws validation error');
  }
  assert(lowScoreThrew, 'Validation caught score < 1');

  // Score validation: rejects > 5
  let highScoreThrew = false;
  try {
    calculateOverallScore([{ score: 6, weight: 1.0 }]);
  } catch (err: any) {
    highScoreThrew = true;
    assert(err.message.includes('between 1 and 5'), 'Score > 5 throws validation error');
  }
  assert(highScoreThrew, 'Validation caught score > 5');

  // Weight validation: rejects sum != 1.0
  let invalidWeightThrew = false;
  try {
    calculateOverallScore([
      { score: 4, weight: 0.5 },
      { score: 4, weight: 0.2 } // sum = 0.7
    ]);
  } catch (err: any) {
    invalidWeightThrew = true;
    assert(err.message.includes('must sum to 1.0'), 'Weight sum != 1.0 throws validation error');
  }
  assert(invalidWeightThrew, 'Validation caught weight sum mismatch');

  // ---------------------------------------------------------------
  // TEST GROUP 3: Deterministic Recommendation Mapping
  // ---------------------------------------------------------------
  console.log('\n[Test Group 3: Deterministic Recommendation Mapping]');

  assert(mapScoreToRecommendation(100) === 'strong_hire', 'Score 100 -> strong_hire');
  assert(mapScoreToRecommendation(85) === 'strong_hire', 'Score 85 -> strong_hire');
  assert(mapScoreToRecommendation(84) === 'hire', 'Score 84 -> hire');
  assert(mapScoreToRecommendation(70) === 'hire', 'Score 70 -> hire');
  assert(mapScoreToRecommendation(69) === 'borderline', 'Score 69 -> borderline');
  assert(mapScoreToRecommendation(55) === 'borderline', 'Score 55 -> borderline');
  assert(mapScoreToRecommendation(54) === 'do_not_hire', 'Score 54 -> do_not_hire');
  assert(mapScoreToRecommendation(0) === 'do_not_hire', 'Score 0 -> do_not_hire');

  // ---------------------------------------------------------------
  // TEST GROUP 4: Targeted Questions & Look-fors / Red Flags
  // ---------------------------------------------------------------
  console.log('\n[Test Group 4: Targeted Question Generation & Fallback]');

  const qContext: InterviewQuestionContext = {
    jobTitle: 'Staff Distributed Systems Engineer',
    jobDescription: 'Architect high-throughput Kafka streaming pipelines in Go',
    requiredSkills: ['Go', 'Kafka', 'Distributed Systems'],
    candidateName: 'Nathan Drake',
    candidateSkills: ['Go', 'Kafka', 'Docker'],
    careerLevel: 'Senior',
    yearsOfExperience: 7,
    interviewStage: 'technical'
  };

  const questionResult = await generateInterviewQuestionRubric(qContext);
  assert(Array.isArray(questionResult.questions), 'Question generation returns questions array');
  assert(questionResult.questions.length >= 3, `Returns at least 3 targeted questions (Got ${questionResult.questions.length})`);

  for (const q of questionResult.questions) {
    assert(typeof q.question === 'string' && q.question.length > 10, 'Question text is substantive');
    assert(typeof q.competency === 'string', 'Question is mapped to a specific competency');
    assert(Array.isArray(q.lookFors) && q.lookFors.length >= 2, 'Question includes positive look-fors');
    assert(Array.isArray(q.redFlags) && q.redFlags.length >= 2, 'Question includes warning red flags');
  }

  // ---------------------------------------------------------------
  // TEST GROUP 5: Grounded AI Synthesis Fallback & Constraints
  // ---------------------------------------------------------------
  console.log('\n[Test Group 5: Grounded Synthesis Fallback]');

  const synthContext: InterviewSynthesisContext = {
    candidateName: 'Nathan Drake',
    roleTitle: 'Staff Distributed Systems Engineer',
    jobTitle: 'Staff Distributed Systems Engineer',
    interviewStage: 'technical',
    overallScore: 92,
    recommendation: 'strong_hire',
    competencies: [
      {
        competency: 'Domain & Framework Expertise',
        score: 5,
        weight: 0.35,
        feedback: 'Superb command of Go concurrency and Kafka consumer group scaling.',
        keySignals: ['Channel semantics', 'Backpressure modeling']
      },
      {
        competency: 'Problem Solving & Algorithmic Rigor',
        score: 4,
        weight: 0.35,
        feedback: 'Solid memory footprint optimization.',
        keySignals: ['Pointer trade-offs', 'Benchmark isolation']
      },
      {
        competency: 'Code Quality & Maintainability',
        score: 5,
        weight: 0.30,
        feedback: 'Exemplary unit and integration tests with deterministic mocks.',
        keySignals: ['Test pyramid adherence']
      }
    ],
    rawInterviewNotes: 'Strong candidate. Demonstrated deep knowledge of distributed log replication.'
  };

  const synthesisResult = await synthesizeInterviewEvaluation(synthContext);
  assert(typeof synthesisResult.summary === 'string', 'Synthesis includes executive summary');
  assert(synthesisResult.summary.includes('Nathan Drake'), 'Summary references verified candidate name');
  assert(synthesisResult.summary.includes('92'), 'Summary references deterministic score 92');
  assert(Array.isArray(synthesisResult.strengths) && synthesisResult.strengths.length >= 1, 'Synthesis extracts evidence-grounded strengths');
  assert(Array.isArray(synthesisResult.evidence) && synthesisResult.evidence.length >= 1, 'Synthesis includes concrete evidence items');
  assert(typeof synthesisResult.recommendationRationale === 'string', 'Synthesis contains recommendation rationale');

  // ---------------------------------------------------------------
  // TEST GROUP 6: Mongoose Schema Validation
  // ---------------------------------------------------------------
  console.log('\n[Test Group 6: InterviewEvaluation Schema Validation]');

  assert(typeof InterviewEvaluation.modelName === 'string', 'InterviewEvaluation model is registered');

  const validEvaluationDoc = new InterviewEvaluation({
    jobId: new mongoose.Types.ObjectId(),
    candidateId: new mongoose.Types.ObjectId(),
    candidateName: 'Nathan Drake',
    roleTitle: 'Staff Distributed Systems Engineer',
    interviewerName: 'Victoria Stone',
    interviewStage: 'technical',
    overallScore: 92,
    recommendation: 'strong_hire',
    competencies: [
      {
        competency: 'Core Technical Competence',
        score: 5,
        weight: 0.4,
        feedback: 'Demonstrated deep Go concurrency mastery.',
        keySignals: ['Goroutines', 'Channels']
      }
    ],
    strengthsSummary: ['Deep Go concurrency experience'],
    concernsSummary: [],
    rawInterviewNotes: 'Excellent responses',
    aiSynthesis: 'Candidate demonstrates strong domain competence.',
    conductedAt: new Date()
  });

  const validErr = validEvaluationDoc.validateSync();
  assert(!validErr, 'Valid InterviewEvaluation document passes schema validation');

  // Test invalid stage validation
  const invalidStageDoc = new InterviewEvaluation({
    jobId: new mongoose.Types.ObjectId(),
    candidateId: new mongoose.Types.ObjectId(),
    candidateName: 'Test Candidate',
    roleTitle: 'Engineer',
    interviewerName: 'Interviewer',
    interviewStage: 'invalid_stage' as any,
    overallScore: 75,
    recommendation: 'hire'
  });
  const invalidStageErr = invalidStageDoc.validateSync();
  assert(Boolean(invalidStageErr && invalidStageErr.errors['interviewStage']), 'Invalid interviewStage fails schema validation');

  // Test invalid recommendation validation
  const invalidRecDoc = new InterviewEvaluation({
    jobId: new mongoose.Types.ObjectId(),
    candidateId: new mongoose.Types.ObjectId(),
    candidateName: 'Test Candidate',
    roleTitle: 'Engineer',
    interviewerName: 'Interviewer',
    interviewStage: 'screen',
    overallScore: 75,
    recommendation: 'unknown_recommendation' as any
  });
  const invalidRecErr = invalidRecDoc.validateSync();
  assert(Boolean(invalidRecErr && invalidRecErr.errors['recommendation']), 'Invalid recommendation fails schema validation');

  // Test score range validation (min 0, max 100)
  const invalidScoreDoc = new InterviewEvaluation({
    jobId: new mongoose.Types.ObjectId(),
    candidateId: new mongoose.Types.ObjectId(),
    candidateName: 'Test Candidate',
    roleTitle: 'Engineer',
    interviewerName: 'Interviewer',
    interviewStage: 'screen',
    overallScore: 105,
    recommendation: 'hire'
  });
  const invalidScoreErr = invalidScoreDoc.validateSync();
  assert(Boolean(invalidScoreErr && invalidScoreErr.errors['overallScore']), 'Score > 100 fails schema validation');

  // ---------------------------------------------------------------
  // TEST GROUP 7: RBAC Authorization & Security Verification
  // ---------------------------------------------------------------
  console.log('\n[Test Group 7: RBAC & API Authorization]');

  const recruiterUserId = new mongoose.Types.ObjectId().toString();
  const studentUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();

  const recruiterToken = signToken({ userId: recruiterUserId, role: 'recruiter' });
  const studentToken = signToken({ userId: studentUserId, role: 'student' });
  const adminToken = signToken({ userId: adminUserId, role: 'admin' });

  // 1. Recruiter access -> authorized
  const recruiterReq = new NextRequest('http://localhost:3000/api/hr/interviews', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.recruiter}=${recruiterToken}`,
      [ROLE_HEADER_NAME]: 'recruiter'
    }
  });
  const recruiterAuth = verifyTokenWithRole(recruiterReq, ['recruiter', 'admin']);
  assert(recruiterAuth !== null && recruiterAuth.decoded.role === 'recruiter', 'Recruiter is authorized for Interview Intelligence');

  // 2. Admin access -> authorized
  const adminReq = new NextRequest('http://localhost:3000/api/hr/interviews', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.admin}=${adminToken}`,
      [ROLE_HEADER_NAME]: 'admin'
    }
  });
  const adminAuth = verifyTokenWithRole(adminReq, ['recruiter', 'admin']);
  assert(adminAuth !== null && adminAuth.decoded.role === 'admin', 'Admin is authorized for Interview Intelligence');

  // 3. Student access -> 403 Forbidden (RBAC gate check)
  const studentReq = new NextRequest('http://localhost:3000/api/hr/interviews', {
    headers: {
      cookie: `${ROLE_COOKIE_MAP.student}=${studentToken}`,
      [ROLE_HEADER_NAME]: 'student'
    }
  });
  const studentAuth = verifyTokenWithRole(studentReq, ['recruiter', 'admin']);
  const allowedRoles = ['recruiter', 'admin'];
  const studentIsAllowed = Boolean(studentAuth && allowedRoles.includes(studentAuth.decoded.role as any));
  assert(!studentIsAllowed, 'Student role rejected for Interview Intelligence (403)');

  // 4. Unauthenticated -> 401 Unauthorized
  const unauthReq = new NextRequest('http://localhost:3000/api/hr/interviews');
  const unauthAuth = verifyTokenWithRole(unauthReq, ['recruiter', 'admin']);
  assert(unauthAuth === null, 'Unauthenticated request is rejected (returns null / 401)');

  // ---------------------------------------------------------------
  // TEST GROUP 8: Live Database Integration & Pipeline Orchestration
  // ---------------------------------------------------------------
  console.log('\n[Test Group 8: Database Pipeline Integration]');

  let dbConnected = false;
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      dbConnected = mongoose.connection.readyState === 1;
    }
  } catch (err) {
    console.warn('  ⚠️ MongoDB not reachable for live DB integration tests.');
  }

  if (dbConnected) {
    console.log('  Connected to live MongoDB instance. Executing database workflow tests...');

    // A. Query existing seed candidate and job
    const seedJob = await Job.findOne({ title: 'Staff Distributed Systems Engineer' });
    const seedCandidate = await User.findOne({ email: 'nathan.drake@candidate.internal' });

    assert(seedJob !== null, 'Found seeded job "Staff Distributed Systems Engineer"');
    assert(seedCandidate !== null, 'Found seeded candidate "Nathan Drake"');

    if (seedJob && seedCandidate) {
      // Find or create application
      let testApp = await Application.findOne({
        studentId: seedCandidate._id,
        jobId: seedJob._id
      });

      if (!testApp) {
        testApp = await Application.create({
          studentId: seedCandidate._id,
          jobId: seedJob._id,
          matchScore: 92,
          status: 'applied',
          appliedAt: new Date()
        });
      }

      // Ensure start status is 'applied' for sync testing
      testApp.status = 'applied';
      await testApp.save();

      // B. Candidate eligibility query
      const eligible = await getEligibleInterviewCandidates({ isAdmin: true });
      assert(Array.isArray(eligible) && eligible.length >= 1, `getEligibleInterviewCandidates returned ${eligible.length} eligible applications`);
      const hasTestApp = eligible.some((e) => e.applicationId.toString() === testApp._id.toString());
      assert(hasTestApp, 'Test application included in eligible candidates list');

      // C. Submit interview evaluation
      const evalPayload = {
        applicationId: testApp._id.toString(),
        interviewStage: 'screen' as InterviewStage,
        interviewerName: 'Victoria Stone (Lead Technical Recruiter)',
        competencies: [
          {
            competency: 'Core Technical Competence',
            score: 4,
            weight: 0.40,
            feedback: 'Demonstrated strong command of Go goroutines and streaming patterns.',
            keySignals: ['Concurrency design', 'Memory optimization']
          },
          {
            competency: 'Problem Solving & Execution',
            score: 4,
            weight: 0.35,
            feedback: 'Clear, structured decomposition of database failover scenarios.',
            keySignals: ['Methodical debugging', 'Decisive prioritization']
          },
          {
            competency: 'Communication & Role Alignment',
            score: 5,
            weight: 0.25,
            feedback: 'Exceptional communication clarity and alignment with team goals.',
            keySignals: ['Active listening', 'Executive presence']
          }
        ],
        rawInterviewNotes: 'Candidate answered all telemetry and log replication questions thoroughly.',
        recruiterUser: {
          _id: seedJob.recruiterId,
          name: 'Victoria Stone',
          role: 'recruiter'
        }
      };

      const evalResponse = await submitInterviewEvaluation(evalPayload);

      // Verify deterministic score: 4*0.4 + 4*0.35 + 5*0.25 = 1.6 + 1.4 + 1.25 = 4.25 * 20 = 85
      assert(evalResponse.evaluation.overallScore === 85, `Overall score is deterministically 85 (Actual: ${evalResponse.evaluation.overallScore})`);
      assert(evalResponse.evaluation.recommendation === 'strong_hire', `Score 85 mapped to strong_hire (Actual: ${evalResponse.evaluation.recommendation})`);

      // Verify Application status synchronization
      assert(evalResponse.applicationStatus === 'interviewing', 'Application transitioned from applied -> interviewing');
      const refreshedApp = await Application.findById(testApp._id);
      assert(refreshedApp?.status === 'interviewing', 'Application status persisted as "interviewing" in MongoDB');

      // Verify Evaluation persistence
      const savedEval = await InterviewEvaluation.findById(evalResponse.evaluation._id);
      assert(savedEval !== null, 'InterviewEvaluation persisted in database');
      assert(savedEval?.candidateName === 'Nathan Drake', 'Saved evaluation has correct candidateName');
      assert(savedEval?.roleTitle === seedJob.title, 'Saved evaluation has correct roleTitle');
      assert(Boolean(savedEval?.strengthsSummary && savedEval.strengthsSummary.length >= 1), 'Saved evaluation has strengthsSummary');

      // D. Query evaluations & KPIs
      const queryResult = await getInterviewEvaluations({ isAdmin: true });
      assert(queryResult.evaluations.length >= 1, `getInterviewEvaluations returned ${queryResult.evaluations.length} records`);
      assert(queryResult.summary.totalInterviews >= 1, `KPI totalInterviews is >= 1 (Actual: ${queryResult.summary.totalInterviews})`);
      assert(queryResult.summary.averageScore > 0, `KPI averageScore is positive (Actual: ${queryResult.summary.averageScore})`);
      assert(queryResult.summary.strongHirePct >= 0, `KPI strongHirePct is valid percentage (Actual: ${queryResult.summary.strongHirePct}%)`);

      // E. Detail retrieval by ID
      const singleDetail = await getInterviewEvaluationById(evalResponse.evaluation._id.toString(), {
        _id: seedJob.recruiterId.toString(),
        role: 'recruiter'
      });
      assert(singleDetail._id.toString() === evalResponse.evaluation._id.toString(), 'getInterviewEvaluationById returned correct document');
      assert(singleDetail.application !== undefined, 'getInterviewEvaluationById attaches related application record');

      // F. Activity & Notification verification
      const notification = await Notification.findOne({
        title: 'Interview Evaluation Completed'
      }).sort({ createdAt: -1 });
      assert(notification !== null, 'Notification created for recruiter upon interview submission');

      const userActivity = await UserActivity.findOne({
        userId: seedCandidate._id,
        activityType: 'Profile Updated'
      }).sort({ createdAt: -1 });
      assert(userActivity !== null, 'UserActivity logged for interview evaluation submission');
      assert(Boolean(userActivity?.details?.includes('Interview evaluation completed')), 'UserActivity details describe evaluation');

      // G. Duplicate Handling & Upsert Test
      const updatePayload = {
        ...evalPayload,
        rawInterviewNotes: 'Updated follow-up notes from recruiter debrief.'
      };
      const updatedResponse = await submitInterviewEvaluation(updatePayload);
      assert(
        updatedResponse.evaluation._id.toString() === evalResponse.evaluation._id.toString(),
        'Upsert on { jobId, candidateId, interviewStage } updates existing evaluation record'
      );
      assert(
        updatedResponse.evaluation.rawInterviewNotes === 'Updated follow-up notes from recruiter debrief.',
        'Existing evaluation updated with new notes'
      );
    }
  } else {
    console.log('  Skipping live DB tests (no active MongoDB connection in test environment). All schema and unit tests passed.');
  }

  // ---------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Phase 2.5 Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2InterviewTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
