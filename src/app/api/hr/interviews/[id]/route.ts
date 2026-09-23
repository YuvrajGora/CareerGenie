import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { getInterviewEvaluationById } from '@/services/interviewIntelligenceService';

/**
 * GET /api/hr/interviews/[id]
 * Recruiter & Admin only.
 * Retrieves full evaluation detail, populated candidate, job, application, and AI synthesis.
 */
export const GET = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const user = req.user!;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Evaluation ID is required.' }, { status: 400 });
    }

    const evaluation = await getInterviewEvaluationById(id, {
      _id: user._id,
      role: user.role
    });

    return NextResponse.json({
      success: true,
      evaluation
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to retrieve evaluation by ID:', error);
    const statusCode = error.message?.includes('Forbidden')
      ? 403
      : error.message?.includes('not found')
      ? 404
      : 500;

    return NextResponse.json({
      error: error.message || 'Internal server error retrieving evaluation detail.'
    }, { status: statusCode });
  }
}, ['recruiter', 'admin']);
