import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getWorkforceSkillOverview } from '@/services/workforceSkillIntelligenceService';

/**
 * GET /api/hr/skills
 * Retrieves organization-wide workforce skill intelligence overview and department summaries.
 * Restricted to authorized recruiter and admin roles.
 */
export const GET = withAuth(async () => {
  try {
    const overview = await getWorkforceSkillOverview();
    return NextResponse.json({
      success: true,
      overview,
      data: overview
    }, { status: 200 });
  } catch (error: any) {
    console.error('Workforce skill overview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error retrieving workforce skill overview.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
