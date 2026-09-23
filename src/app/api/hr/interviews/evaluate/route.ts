import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import {
  submitInterviewEvaluation,
  InterviewStage
} from '@/services/interviewIntelligenceService';

/**
 * POST /api/hr/interviews/evaluate
 * Recruiter & Admin only.
 * Evaluates a candidate across competency dimensions.
 * Server deterministically calculates overallScore and recommendation.
 * Client-supplied score or recommendation is strictly ignored.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = req.user!;
    const body = await req.json().catch(() => ({}));

    const {
      applicationId,
      interviewStage,
      interviewerName,
      competencies,
      rawInterviewNotes
    } = body;

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID is required to submit an interview evaluation.' },
        { status: 400 }
      );
    }

    const validStages: InterviewStage[] = ['screen', 'technical', 'system_design', 'culture_fit', 'final'];
    if (!interviewStage || !validStages.includes(interviewStage)) {
      return NextResponse.json(
        { error: `Invalid or missing interviewStage. Must be one of: ${validStages.join(', ')}.` },
        { status: 400 }
      );
    }

    if (!Array.isArray(competencies) || competencies.length === 0) {
      return NextResponse.json(
        { error: 'At least one competency score evaluation is required.' },
        { status: 400 }
      );
    }

    // Validate that each competency item has valid score (1-5) and weight (>0)
    for (let i = 0; i < competencies.length; i++) {
      const c = competencies[i];
      if (!c.competency || typeof c.competency !== 'string') {
        return NextResponse.json(
          { error: `Competency at index ${i} is missing a valid name.` },
          { status: 400 }
        );
      }
      if (typeof c.score !== 'number' || c.score < 1 || c.score > 5) {
        return NextResponse.json(
          { error: `Score for "${c.competency}" must be a number between 1 and 5.` },
          { status: 400 }
        );
      }
      if (typeof c.weight !== 'number' || c.weight <= 0 || c.weight > 1) {
        return NextResponse.json(
          { error: `Weight for "${c.competency}" must be a number between 0 and 1.` },
          { status: 400 }
        );
      }
    }

    const result = await submitInterviewEvaluation({
      applicationId,
      interviewStage,
      interviewerName: interviewerName || user.name,
      competencies,
      rawInterviewNotes: rawInterviewNotes || '',
      recruiterUser: {
        _id: user._id,
        name: user.name,
        role: user.role
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Interview evaluation recorded successfully.',
      evaluation: result.evaluation,
      synthesis: result.synthesis,
      applicationStatus: result.applicationStatus
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to submit interview evaluation:', error);
    const statusCode = error.message?.includes('Forbidden')
      ? 403
      : error.message?.includes('not found')
      ? 404
      : error.message?.includes('Invalid') || error.message?.includes('must sum')
      ? 400
      : 500;

    return NextResponse.json({
      error: error.message || 'Internal server error processing interview evaluation.'
    }, { status: statusCode });
  }
}, ['recruiter', 'admin']);
