import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { generateAndSaveOnboardingPlan } from '@/services/onboardingOrchestratorService';

/**
 * POST /api/hr/onboarding/generate
 * Generates an adaptive, policy-grounded onboarding plan for an employee.
 * Validates that the employee exists and does not already have an active onboarding plan.
 * Restricted to 'recruiter' and 'admin' roles.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { employeeId, mentorName, startDate, useAi } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Field "employeeId" is required.' }, { status: 400 });
    }

    const plan = await generateAndSaveOnboardingPlan(employeeId, {
      mentorName,
      startDate: startDate ? new Date(startDate) : undefined,
      useAi: useAi !== false,
      currentUserId: req.user?._id?.toString()
    });

    return NextResponse.json({
      success: true,
      message: 'Adaptive onboarding plan successfully generated and activated.',
      plan
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to generate onboarding plan:', error);
    const msg = error.message || 'Internal server error while generating onboarding plan.';

    if (msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}, ['recruiter', 'admin']);
