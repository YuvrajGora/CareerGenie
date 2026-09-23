import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { generateCandidateCsv } from '@/services/recruitmentIntelligenceService';
import { recordActivity } from '@/services/activity';

/**
 * GET /api/hr/recruitment/export
 * Generates and downloads an RFC 4180 compliant CSV of the ranked candidate shortlist.
 * Includes sanitization against spreadsheet formula injection.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const user = req.user;
    const { searchParams } = new URL(req.url);

    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({
        error: 'Job ID parameter (jobId) is required for CSV export.'
      }, { status: 400 });
    }

    const minScoreParam = searchParams.get('minScore');
    const minScore = minScoreParam !== null && minScoreParam !== '' ? Number(minScoreParam) : undefined;
    const status = searchParams.get('status') || undefined;
    const skillFilter = searchParams.get('skillFilter') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || undefined;
    const sortOrder = (searchParams.get('sortOrder') as any) || undefined;

    const { filename, csv } = await generateCandidateCsv(
      jobId,
      {
        jobId,
        minScore,
        status,
        skillFilter,
        search,
        sortBy,
        sortOrder
      },
      user._id.toString(),
      user.role
    );

    // Record recruiter activity
    recordActivity(
      user._id,
      'Profile Updated',
      `Exported candidate rankings CSV shortlist (${filename}) for job ${jobId}.`,
      { jobId, filename, action: 'recruitment_export' }
    ).catch(err => console.error('Activity logging failed for recruitment export:', err));

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    console.error('Recruitment CSV export error:', error);
    const message = error.message || 'Internal server error exporting candidate shortlist.';
    const statusCode = message.includes('Forbidden') ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, ['recruiter', 'admin']);
