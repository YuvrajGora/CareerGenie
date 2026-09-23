import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import {
  getInterviewEvaluations,
  getEligibleInterviewCandidates
} from '@/services/interviewIntelligenceService';

/**
 * GET /api/hr/interviews
 * Recruiter & Admin only.
 * 
 * Supports:
 * - ?candidates=true : Returns active applications eligible for interview evaluation
 * - ?jobId=...&interviewStage=...&recommendation=...&search=... : Returns evaluations & KPIs
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const candidatesParam = searchParams.get('candidates');

    // Return eligible candidate applications
    if (candidatesParam === 'true') {
      const candidates = await getEligibleInterviewCandidates({
        recruiterId: user._id.toString(),
        isAdmin: user.role === 'admin'
      });

      return NextResponse.json({
        success: true,
        candidates
      }, { status: 200 });
    }

    const jobId = searchParams.get('jobId') || undefined;
    const interviewStage = searchParams.get('interviewStage') || undefined;
    const recommendation = searchParams.get('recommendation') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await getInterviewEvaluations({
      jobId,
      interviewStage,
      recommendation,
      search,
      recruiterId: user._id.toString(),
      isAdmin: user.role === 'admin'
    });

    return NextResponse.json({
      success: true,
      total: result.evaluations.length,
      summary: result.summary,
      evaluations: result.evaluations
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to retrieve interview data:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error retrieving interview records.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
