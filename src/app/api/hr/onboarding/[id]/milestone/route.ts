import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { updateMilestoneState } from '@/services/onboardingOrchestratorService';

/**
 * PATCH /api/hr/onboarding/[id]/milestone
 * Toggles milestone completion state, updates notes, recalculates progress/velocity,
 * emits EmployeeSignal telemetry, and automatically transitions employee status upon 100% completion.
 * Restricted to 'recruiter' and 'admin' roles.
 */
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
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
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { milestoneId, completed, notes, verifiedBy } = body;

    if (!milestoneId) {
      return NextResponse.json({ error: 'Field "milestoneId" is required.' }, { status: 400 });
    }

    const result = await updateMilestoneState(id, milestoneId, {
      completed: Boolean(completed),
      notes,
      verifiedBy: verifiedBy || req.user?.name || 'Recruiter/Admin',
      currentUserId: req.user?._id?.toString()
    });

    return NextResponse.json({
      success: true,
      message: `Milestone '${milestoneId}' updated successfully.`,
      plan: result.plan,
      metrics: result.metrics
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to update onboarding milestone:', error);
    const msg = error.message || 'Internal server error while updating milestone.';

    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}, ['recruiter', 'admin']);
