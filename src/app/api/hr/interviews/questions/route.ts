import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import {
  generateTargetedInterviewQuestions,
  generateDeterministicRubric,
  InterviewStage
} from '@/services/interviewIntelligenceService';

/**
 * POST /api/hr/interviews/questions
 * Recruiter & Admin only.
 * Generates targeted, evidence-grounded probe questions with look-fors and red flags.
 * Also returns the deterministic competency rubric template for the requested interview stage.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { applicationId, interviewStage } = body;

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID is required to generate targeted interview questions.' },
        { status: 400 }
      );
    }

    const validStages: InterviewStage[] = ['screen', 'technical', 'system_design', 'culture_fit', 'final'];
    const stage: InterviewStage = validStages.includes(interviewStage) ? interviewStage : 'screen';

    // Generate questions grounded in verified candidate & job facts
    const result = await generateTargetedInterviewQuestions(applicationId, stage);

    // Retrieve deterministic rubric template for this stage
    const rubric = generateDeterministicRubric(stage, { title: result.jobTitle });

    return NextResponse.json({
      success: true,
      stage: result.stage,
      candidateName: result.candidateName,
      jobTitle: result.jobTitle,
      questions: result.questions,
      defaultRubric: rubric
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to generate interview questions:', error);
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    return NextResponse.json({
      error: error.message || 'Internal server error generating targeted interview questions.'
    }, { status: statusCode });
  }
}, ['recruiter', 'admin']);
