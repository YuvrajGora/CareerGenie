import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import connectDB from '@/lib/db';
import { getHRCommandCenterOverview } from '@/services/hrCommandCenterService';
import { generateCommandCenterBriefing } from '@/services/gemini';

/**
 * GET /api/hr/command-center
 * Retrieves the complete cross-module HR Command Center overview.
 * Restricted server-side to 'recruiter' and 'admin' roles.
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();

    const user = req.user!;
    const userId = user._id ? user._id.toString() : '';
    const userRole = (user.role || 'recruiter') as 'recruiter' | 'admin';

    const { searchParams } = new URL(req.url);
    const includeBriefing = searchParams.get('briefing') === 'true';

    const overview = await getHRCommandCenterOverview(userId, userRole);

    let briefing = null;
    if (includeBriefing) {
      try {
        briefing = await generateCommandCenterBriefing(overview);
      } catch (aiErr) {
        console.warn('Briefing generation error, continuing without briefing:', aiErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: overview,
      briefing
    }, { status: 200 });

  } catch (error: any) {
    console.error('HR Command Center API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error retrieving HR Command Center intelligence.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
