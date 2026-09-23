import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import InterviewEvaluation, {
  IInterviewEvaluation,
  ICompetencyEvaluation
} from '@/models/InterviewEvaluation';
import Application, { IApplication } from '@/models/Application';
import Job, { IJob } from '@/models/Job';
import User, { IUser } from '@/models/User';
import JobMatch from '@/models/JobMatch';
import Notification from '@/models/Notification';
import { recordActivity } from '@/services/activity';
import {
  generateInterviewQuestionRubric,
  synthesizeInterviewEvaluation,
  InterviewQuestionContext,
  InterviewSynthesisContext,
  InterviewSynthesisResult,
  InterviewQuestionItem
} from '@/services/gemini';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type InterviewStage = 'screen' | 'technical' | 'system_design' | 'culture_fit' | 'final';
export type InterviewRecommendation = 'strong_hire' | 'hire' | 'borderline' | 'do_not_hire';

export interface DeterministicCompetencyTemplate {
  competency: string;
  score: number;
  weight: number;
  feedback: string;
  keySignals: string[];
}

export interface InterviewRubricDefinition {
  stage: InterviewStage;
  stageTitle: string;
  competencies: DeterministicCompetencyTemplate[];
}

export interface InterviewEvaluationsFilter {
  jobId?: string;
  interviewStage?: string;
  recommendation?: string;
  search?: string;
  recruiterId?: string;
  isAdmin?: boolean;
}

export interface InterviewKPIs {
  totalInterviews: number;
  strongHirePct: number;
  averageScore: number;
  stageDistribution: Record<InterviewStage, number>;
  recommendationDistribution: Record<InterviewRecommendation, number>;
}

export interface SubmitEvaluationParams {
  applicationId: string;
  interviewStage: InterviewStage;
  interviewerName?: string;
  competencies: Array<{
    competency: string;
    score: number;
    weight: number;
    feedback: string;
    keySignals?: string[];
  }>;
  rawInterviewNotes?: string;
  recruiterUser?: {
    _id: string | mongoose.Types.ObjectId;
    name?: string;
    role: string;
  };
}

// ============================================================================
// 1. DETERMINISTIC COMPETENCY RUBRICS BY STAGE
// Weights ALWAYS sum to 1.0
// ============================================================================

export const STAGE_RUBRIC_TEMPLATES: Record<InterviewStage, DeterministicCompetencyTemplate[]> = {
  screen: [
    {
      competency: 'Core Technical Competence',
      score: 3,
      weight: 0.40,
      feedback: 'Demonstrated solid baseline familiarity with required technical concepts and tooling.',
      keySignals: ['Domain terminology familiarity', 'Relevant project examples', 'Accurate skill self-assessment']
    },
    {
      competency: 'Problem Solving & Execution',
      score: 3,
      weight: 0.35,
      feedback: 'Shows structured approach to breaking down operational and technical problems.',
      keySignals: ['Requirement decomposition', 'Pragmatic trade-offs', 'Delivery ownership']
    },
    {
      competency: 'Communication & Role Alignment',
      score: 3,
      weight: 0.25,
      feedback: 'Clear, concise verbal articulation with aligned career motivations and expectations.',
      keySignals: ['Active listening', 'Clear articulation', 'Motivation alignment']
    }
  ],
  technical: [
    {
      competency: 'Domain & Framework Expertise',
      score: 3,
      weight: 0.35,
      feedback: 'Deep idiomatic command of primary languages, frameworks, and runtime behavior.',
      keySignals: ['Idiomatic code structure', 'Memory/concurrency management', 'Boundary error handling']
    },
    {
      competency: 'Problem Solving & Algorithmic Rigor',
      score: 3,
      weight: 0.35,
      feedback: 'Methodical decomposition of non-trivial algorithmic problems with complexity awareness.',
      keySignals: ['Time/space complexity analysis', 'Edge-case identification', 'Clean logic iteration']
    },
    {
      competency: 'Code Quality, Testing & Maintainability',
      score: 3,
      weight: 0.30,
      feedback: 'Disciplined approach to automated testing, clean abstractions, and maintainable code.',
      keySignals: ['Comprehensive test assertions', 'Modular component boundaries', 'Readability']
    }
  ],
  system_design: [
    {
      competency: 'Distributed Architecture & Scaling',
      score: 3,
      weight: 0.40,
      feedback: 'Strong grasp of distributed systems, horizontal scaling, partition tolerance, and load balancing.',
      keySignals: ['Microservice decoupling', 'Stateless service tiers', 'Cache hierarchy strategy']
    },
    {
      competency: 'Data Storage & Consistency Modeling',
      score: 3,
      weight: 0.35,
      feedback: 'Thoughtful database selection, data schema modeling, and eventual consistency management.',
      keySignals: ['Relational vs NoSQL trade-offs', 'Read/write throughput modeling', 'Idempotent processing']
    },
    {
      competency: 'Reliability, Security & Observability',
      score: 3,
      weight: 0.25,
      feedback: 'Proactive incorporation of telemetry, rate limiting, zero-trust security, and failover mechanics.',
      keySignals: ['SLI/SLO definition', 'Circuit breakers & rate limiting', 'Telemetry baggage propagation']
    }
  ],
  culture_fit: [
    {
      competency: 'Constructive Collaboration & Empathy',
      score: 3,
      weight: 0.40,
      feedback: 'Exemplifies respectful debate, psychological safety, and disagree-and-commit maturity.',
      keySignals: ['Empathy in peer interactions', 'Blameless communication', 'Cross-functional respect']
    },
    {
      competency: 'Growth Mindset & Feedback Receptivity',
      score: 3,
      weight: 0.30,
      feedback: 'Demonstrates humility, eagerness to iterate based on critique, and active self-improvement.',
      keySignals: ['Receptivity to critical input', 'Continuous learning habits', 'Self-awareness of blindspots']
    },
    {
      competency: 'Ownership & Ambiguity Management',
      score: 3,
      weight: 0.30,
      feedback: 'Takes proactive initiative in uncertain circumstances without requiring micromanagement.',
      keySignals: ['Independent initiative', 'Transparent status communication', 'Customer-centric prioritization']
    }
  ],
  final: [
    {
      competency: 'Strategic Vision & Technical Leadership',
      score: 3,
      weight: 0.40,
      feedback: 'Balances immediate project velocity with long-term platform health and strategic goals.',
      keySignals: ['Executive presence', 'Long-term architectural roadmap', 'Pragmatic tech-debt management']
    },
    {
      competency: 'Mentorship & Engineering Standards',
      score: 3,
      weight: 0.35,
      feedback: 'History of elevating engineering team capabilities, high-signal reviews, and knowledge transfer.',
      keySignals: ['Mentorship cadence', 'Educational code reviews', 'Engineering playbook authorship']
    },
    {
      competency: 'Business Acumen & Pragmatism',
      score: 3,
      weight: 0.25,
      feedback: 'Connects engineering decisions directly to business outcomes, user satisfaction, and ROI.',
      keySignals: ['ROI-driven prioritization', 'Cost-effective infrastructure', 'Product-engineering synergy']
    }
  ]
};

// ============================================================================
// 2. DETERMINISTIC SCORING & RECOMMENDATION ENGINE
// ============================================================================

/**
 * Validates competency scores (1-5) and weights (sum = 1.0),
 * and computes overall score: clamp(Σ(score_i × weight_i) × 20, 0, 100).
 */
export function calculateOverallScore(
  competencies: Array<{ score: number; weight: number }>
): number {
  if (!competencies || competencies.length === 0) {
    throw new Error('At least one competency evaluation is required.');
  }

  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const c of competencies) {
    if (typeof c.score !== 'number' || c.score < 1 || c.score > 5) {
      throw new Error(`Invalid competency score: ${c.score}. Scores must be numbers between 1 and 5.`);
    }
    if (typeof c.weight !== 'number' || c.weight <= 0 || c.weight > 1) {
      throw new Error(`Invalid competency weight: ${c.weight}. Weights must be positive numbers <= 1.`);
    }

    totalWeight += c.weight;
    weightedScoreSum += c.score * c.weight;
  }

  // Verify weights sum to 1.0 (with small floating point tolerance)
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    throw new Error(
      `Competency weights must sum to 1.0. Current sum: ${Number(totalWeight.toFixed(4))}`
    );
  }

  // overallScore = Σ(score_i × weight_i) × 20, clamped to 0-100
  const rawScore = weightedScoreSum * 20;
  const clampedScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return clampedScore;
}

/**
 * Maps deterministic overall score to recommendation:
 * 85-100 = strong_hire
 * 70-84 = hire
 * 55-69 = borderline
 * 0-54 = do_not_hire
 */
export function mapScoreToRecommendation(score: number): InterviewRecommendation {
  if (score >= 85) return 'strong_hire';
  if (score >= 70) return 'hire';
  if (score >= 55) return 'borderline';
  return 'do_not_hire';
}

/**
 * Generates a deterministic rubric template for a given stage, customized with job context.
 */
export function generateDeterministicRubric(
  stage: InterviewStage,
  job?: { title?: string; requiredSkills?: string[] }
): DeterministicCompetencyTemplate[] {
  const baseTemplate = STAGE_RUBRIC_TEMPLATES[stage] || STAGE_RUBRIC_TEMPLATES.screen;

  // Deep clone to avoid mutating base definitions
  return baseTemplate.map((c) => ({
    competency: c.competency,
    score: c.score,
    weight: c.weight,
    feedback: job?.requiredSkills?.length
      ? `${c.feedback} (Context: ${job.requiredSkills.slice(0, 3).join(', ')})`
      : c.feedback,
    keySignals: [...c.keySignals]
  }));
}

// ============================================================================
// 3. TARGETED QUESTION GENERATION
// Assembles verified facts only, calls Gemini with deterministic fallback
// ============================================================================

export async function generateTargetedInterviewQuestions(
  applicationId: string,
  stage: InterviewStage
): Promise<{ questions: InterviewQuestionItem[]; stage: InterviewStage; candidateName: string; jobTitle: string }> {
  await connectDB();

  const application = await Application.findById(applicationId)
    .populate('jobId')
    .populate('studentId', 'name email skills education yearsOfExperience careerLevel');

  if (!application) {
    throw new Error('Application not found.');
  }

  const job = application.jobId as unknown as IJob;
  const candidate = application.studentId as unknown as IUser;

  if (!job || !candidate) {
    throw new Error('Associated job or candidate record not found for application.');
  }

  // Retrieve JobMatch breakdown if available
  const jobMatch = await JobMatch.findOne({
    studentId: candidate._id,
    jobId: job._id
  });

  const questionContext: InterviewQuestionContext = {
    jobTitle: job.title,
    jobDescription: job.description,
    requiredSkills: job.requiredSkills || [],
    candidateName: candidate.name,
    candidateSkills: candidate.skills || [],
    careerLevel: candidate.careerLevel || 'Mid-Level',
    yearsOfExperience: candidate.yearsOfExperience ?? 0,
    interviewStage: stage,
    matchBreakdown: jobMatch
      ? {
          matchScore: jobMatch.matchScore,
          skillsMatch: jobMatch.skillsMatch,
          experienceMatch: jobMatch.experienceMatch,
          educationMatch: jobMatch.educationMatch
        }
      : undefined
  };

  const rubricResult = await generateInterviewQuestionRubric(questionContext);

  return {
    questions: rubricResult.questions,
    stage,
    candidateName: candidate.name,
    jobTitle: job.title
  };
}

// ============================================================================
// 4. EVALUATION SUBMISSION & PIPELINE ORCHESTRATION
// ============================================================================

export async function submitInterviewEvaluation(
  params: SubmitEvaluationParams
): Promise<{
  evaluation: IInterviewEvaluation;
  synthesis: InterviewSynthesisResult;
  applicationStatus: string;
}> {
  await connectDB();

  const {
    applicationId,
    interviewStage,
    interviewerName,
    competencies,
    rawInterviewNotes,
    recruiterUser
  } = params;

  // 1. Validate application, candidate, and job
  const application = await Application.findById(applicationId)
    .populate('jobId')
    .populate('studentId', 'name email skills education yearsOfExperience careerLevel');

  if (!application) {
    throw new Error('Application not found.');
  }

  const job = application.jobId as unknown as IJob;
  const candidate = application.studentId as unknown as IUser;

  if (!job || !candidate) {
    throw new Error('Associated job or candidate record could not be resolved.');
  }

  // Authorization check: if recruiter, ensure they own the job (or user is admin)
  if (recruiterUser && recruiterUser.role === 'recruiter') {
    const jobRecruiterId = job.recruiterId ? job.recruiterId.toString() : '';
    const currentUserId = recruiterUser._id ? recruiterUser._id.toString() : '';
    if (jobRecruiterId && jobRecruiterId !== currentUserId) {
      throw new Error('Forbidden. You do not have permission to evaluate candidates for this job posting.');
    }
  }

  // 2. Validate interview stage
  const validStages: InterviewStage[] = ['screen', 'technical', 'system_design', 'culture_fit', 'final'];
  if (!validStages.includes(interviewStage)) {
    throw new Error(`Invalid interview stage "${interviewStage}". Must be one of: ${validStages.join(', ')}.`);
  }

  // 3. Validate competency scores and calculate deterministic overall score
  const overallScore = calculateOverallScore(competencies);

  // 4. Calculate deterministic recommendation
  const recommendation = mapScoreToRecommendation(overallScore);

  // 5. Generate evidence-grounded AI synthesis (via Gemini with deterministic fallback)
  const synthesisContext: InterviewSynthesisContext = {
    candidateName: candidate.name,
    roleTitle: job.title,
    jobTitle: job.title,
    interviewStage,
    overallScore,
    recommendation,
    competencies: competencies.map((c) => ({
      competency: c.competency,
      score: c.score,
      weight: c.weight,
      feedback: c.feedback || '',
      keySignals: c.keySignals || []
    })),
    rawInterviewNotes: rawInterviewNotes || ''
  };

  const synthesis = await synthesizeInterviewEvaluation(synthesisContext);

  // 6. Format competencies for persistence
  const formattedCompetencies: ICompetencyEvaluation[] = competencies.map((c) => ({
    competency: c.competency,
    score: c.score,
    weight: c.weight,
    feedback: c.feedback || 'Completed evaluation.',
    keySignals: c.keySignals || []
  }));

  const determinedInterviewer =
    interviewerName?.trim() ||
    recruiterUser?.name ||
    'Lead Technical Recruiter';

  // 7. Persist InterviewEvaluation (upsert on { jobId, candidateId, interviewStage })
  const evaluation = await InterviewEvaluation.findOneAndUpdate(
    {
      jobId: job._id,
      candidateId: candidate._id,
      interviewStage
    },
    {
      jobId: job._id,
      candidateId: candidate._id,
      candidateName: candidate.name,
      roleTitle: job.title,
      interviewerName: determinedInterviewer,
      interviewStage,
      overallScore,
      recommendation,
      competencies: formattedCompetencies,
      strengthsSummary: synthesis.strengths,
      concernsSummary: synthesis.concerns,
      rawInterviewNotes: rawInterviewNotes || '',
      aiSynthesis: synthesis.summary,
      conductedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 8. Synchronize Application status:
  // - If currently 'applied', transition to 'interviewing'
  // - If 'interviewing', remain 'interviewing'
  // - DO NOT automatically accept or reject (recruiter retains final decision authority)
  if (application.status === 'applied') {
    application.status = 'interviewing';
    await application.save();
  }

  // 9. Record User Activity
  try {
    await recordActivity(
      candidate._id,
      'Profile Updated',
      `Interview evaluation completed for "${job.title}" (${interviewStage} stage): ${recommendation.replace('_', ' ').toUpperCase()} (${overallScore}/100).`,
      {
        jobId: job._id,
        applicationId: application._id,
        overallScore,
        recommendation,
        interviewStage
      }
    );
  } catch (actErr) {
    console.warn('Failed to record user activity for interview evaluation:', actErr);
  }

  // 10. Create Notification for Recruiter
  try {
    const notifyRecipientId = recruiterUser?._id || job.recruiterId;
    if (notifyRecipientId) {
      await Notification.create({
        userId: notifyRecipientId,
        title: 'Interview Evaluation Completed',
        message: `Evaluation submitted for ${candidate.name} (${job.title} - ${interviewStage} stage): ${recommendation.replace('_', ' ').toUpperCase()} (${overallScore}/100).`,
        read: false,
        createdAt: new Date()
      });
    }
  } catch (notifErr) {
    console.warn('Failed to dispatch notification for interview evaluation:', notifErr);
  }

  return {
    evaluation,
    synthesis,
    applicationStatus: application.status
  };
}

// ============================================================================
// 5. QUERY & KPI AGGREGATION ENGINE
// ============================================================================

export async function getInterviewEvaluations(
  filters: InterviewEvaluationsFilter
): Promise<{
  evaluations: any[];
  summary: InterviewKPIs;
}> {
  await connectDB();

  const query: Record<string, any> = {};

  // Role scoping: if recruiter (and not admin), filter by jobs owned by that recruiter
  if (!filters.isAdmin && filters.recruiterId) {
    const recruiterJobs = await Job.find({ recruiterId: filters.recruiterId }).select('_id');
    const jobIds = recruiterJobs.map((j) => j._id);
    query.jobId = { $in: jobIds };
  }

  if (filters.jobId && filters.jobId !== 'all') {
    query.jobId = filters.jobId;
  }

  if (filters.interviewStage && filters.interviewStage !== 'all') {
    query.interviewStage = filters.interviewStage;
  }

  if (filters.recommendation && filters.recommendation !== 'all') {
    query.recommendation = filters.recommendation;
  }

  let evaluations = await InterviewEvaluation.find(query)
    .populate('jobId', 'title company location experience requiredSkills')
    .populate('candidateId', 'name email skills education yearsOfExperience careerLevel')
    .sort({ conductedAt: -1, createdAt: -1 })
    .lean();

  // Search filter across candidate name, role title, or interviewer
  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim().toLowerCase();
    evaluations = evaluations.filter((ev: any) => {
      const candName = (ev.candidateName || ev.candidateId?.name || '').toLowerCase();
      const roleTitle = (ev.roleTitle || ev.jobId?.title || '').toLowerCase();
      const interviewer = (ev.interviewerName || '').toLowerCase();
      return candName.includes(term) || roleTitle.includes(term) || interviewer.includes(term);
    });
  }

  // Calculate summary KPIs
  const totalInterviews = evaluations.length;
  let strongHireCount = 0;
  let totalScoreSum = 0;

  const stageDistribution: Record<InterviewStage, number> = {
    screen: 0,
    technical: 0,
    system_design: 0,
    culture_fit: 0,
    final: 0
  };

  const recommendationDistribution: Record<InterviewRecommendation, number> = {
    strong_hire: 0,
    hire: 0,
    borderline: 0,
    do_not_hire: 0
  };

  for (const ev of evaluations) {
    totalScoreSum += ev.overallScore || 0;

    if (ev.recommendation === 'strong_hire') {
      strongHireCount++;
    }

    if (ev.interviewStage && ev.interviewStage in stageDistribution) {
      stageDistribution[ev.interviewStage as InterviewStage]++;
    }

    if (ev.recommendation && ev.recommendation in recommendationDistribution) {
      recommendationDistribution[ev.recommendation as InterviewRecommendation]++;
    }
  }

  const strongHirePct = totalInterviews > 0
    ? Math.round((strongHireCount / totalInterviews) * 100)
    : 0;

  const averageScore = totalInterviews > 0
    ? Math.round(totalScoreSum / totalInterviews)
    : 0;

  const summary: InterviewKPIs = {
    totalInterviews,
    strongHirePct,
    averageScore,
    stageDistribution,
    recommendationDistribution
  };

  return {
    evaluations,
    summary
  };
}

/**
 * Retrieves applications eligible for interview evaluation.
 * Eligible: applications in 'applied' or 'interviewing' status, scoped to recruiter's jobs.
 */
export async function getEligibleInterviewCandidates(options?: {
  recruiterId?: string;
  isAdmin?: boolean;
}): Promise<any[]> {
  await connectDB();

  const query: Record<string, any> = {
    status: { $in: ['applied', 'interviewing'] }
  };

  if (!options?.isAdmin && options?.recruiterId) {
    const recruiterJobs = await Job.find({ recruiterId: options.recruiterId }).select('_id');
    const jobIds = recruiterJobs.map((j) => j._id);
    query.jobId = { $in: jobIds };
  }

  const applications = await Application.find(query)
    .populate('jobId', 'title company location requiredSkills experience')
    .populate('studentId', 'name email skills education yearsOfExperience careerLevel profileImage')
    .sort({ appliedAt: -1 })
    .lean();

  // Attach existing evaluations and job match breakdown if available
  const results = await Promise.all(
    applications.map(async (app: any) => {
      const [existingEvaluations, match] = await Promise.all([
        InterviewEvaluation.find({
          candidateId: app.studentId?._id,
          jobId: app.jobId?._id
        })
          .select('interviewStage overallScore recommendation conductedAt')
          .lean(),
        JobMatch.findOne({
          studentId: app.studentId?._id,
          jobId: app.jobId?._id
        }).lean()
      ]);

      return {
        applicationId: app._id,
        status: app.status,
        appliedAt: app.appliedAt,
        matchScore: app.matchScore,
        matchBreakdown: match
          ? {
              skillsMatch: match.skillsMatch,
              experienceMatch: match.experienceMatch,
              educationMatch: match.educationMatch
            }
          : null,
        candidate: app.studentId,
        job: app.jobId,
        existingEvaluations: existingEvaluations || []
      };
    })
  );

  return results;
}

/**
 * Retrieves a single evaluation by ID with full candidate and job context.
 */
export async function getInterviewEvaluationById(
  id: string,
  user?: { _id: string | mongoose.Types.ObjectId; role: string }
): Promise<any> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid evaluation ID.');
  }

  const evaluation = await InterviewEvaluation.findById(id)
    .populate('jobId')
    .populate('candidateId', 'name email skills education yearsOfExperience careerLevel')
    .lean();

  if (!evaluation) {
    throw new Error('Interview evaluation not found.');
  }

  // Verify recruiter ownership if not admin
  if (user && user.role === 'recruiter') {
    const job = evaluation.jobId as any;
    if (job?.recruiterId && job.recruiterId.toString() !== user._id.toString()) {
      throw new Error('Forbidden. You do not have permission to view this evaluation.');
    }
  }

  // Also fetch related application and match record
  const [application, match] = await Promise.all([
    Application.findOne({
      studentId: (evaluation.candidateId as any)?._id,
      jobId: (evaluation.jobId as any)?._id
    }).lean(),
    JobMatch.findOne({
      studentId: (evaluation.candidateId as any)?._id,
      jobId: (evaluation.jobId as any)?._id
    }).lean()
  ]);

  return {
    ...evaluation,
    application,
    jobMatch: match
  };
}
