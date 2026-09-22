import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { runAdaptiveOnboardingCheck } from '@/services/onboardingOrchestratorService';

/**
 * POST /api/hr/onboarding/[id]/adapt
 * Triggers an adaptive onboarding diagnosis.
 * Analyzes velocity, overdue milestones, and departmental benchmarks.
 * Calls Gemini (or deterministic fallback), records adaptation history, and updates AI guidance notes.
 * Restricted to 'recruiter' and 'admin' roles.
 */
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing onboarding plan ID parameter.' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
      body = {};
    }

    const { useAi } = body;

    const result = await runAdaptiveOnboardingCheck(id, {
      appliedBy: req.user?.name || 'HR Specialist',
      useAi: useAi !== false
    });

    return NextResponse.json({
      success: true,
      message: 'Adaptive onboarding check completed.',
      plan: result.plan,
      diagnosis: result.diagnosis,
      usedGemini: result.usedGemini
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to run adaptive onboarding check:', error);
    const msg = error.message || 'Internal server error while running adaptive check.';

    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}, ['recruiter', 'admin']);
