import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getRankedCandidates } from '@/services/recruitmentIntelligenceService';

/**
 * GET /api/hr/recruitment/candidates
 * Retrieves ranked candidates for a specific job, filtered and sorted.
 * Access strictly restricted to the job's recruiter owner or admin.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const user = req.user;
    const { searchParams } = new URL(req.url);

    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({
        error: 'Job ID parameter (jobId) is required.'
      }, { status: 400 });
    }

    const minScoreParam = searchParams.get('minScore');
    const minScore = minScoreParam !== null && minScoreParam !== '' ? Number(minScoreParam) : undefined;
    const status = searchParams.get('status') || undefined;
    const skillFilter = searchParams.get('skillFilter') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || undefined;
    const sortOrder = (searchParams.get('sortOrder') as any) || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await getRankedCandidates(
      {
        jobId,
        minScore,
        status,
        skillFilter,
        search,
        sortBy,
        sortOrder,
        limit
      },
      user._id.toString(),
      user.role
    );

    return NextResponse.json({
      candidates: result.candidates,
      summary: result.summary,
      job: result.job
    }, { status: 200 });
  } catch (error: any) {
    console.error('Recruitment candidates error:', error);
    const message = error.message || 'Internal server error retrieving ranked candidates.';
    const statusCode = message.includes('Forbidden') ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, ['recruiter', 'admin']);
