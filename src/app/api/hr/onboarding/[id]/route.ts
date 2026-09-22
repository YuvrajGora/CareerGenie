import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { getOnboardingPlanById, calculatePlanMetrics } from '@/services/onboardingOrchestratorService';
import EmployeeSignal from '@/models/EmployeeSignal';

/**
 * GET /api/hr/onboarding/[id]
 * Retrieves a single onboarding plan with populated employee details,
 * calculated live telemetry/velocity metrics, and recent onboarding signals.
 * Restricted to 'recruiter' and 'admin' roles.
 */
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing onboarding plan ID parameter.' }, { status: 400 });
    }

    const plan = await getOnboardingPlanById(id);
    if (!plan) {
      return NextResponse.json({ error: `Onboarding plan '${id}' not found.` }, { status: 404 });
    }

    // Calculate real-time metrics
    const metrics = calculatePlanMetrics(plan, new Date());

    // Fetch recent telemetry signals for this employee
    const signals = await EmployeeSignal.find({
      employeeId: (plan.employeeId as any)?._id || plan.employeeId
    })
      .sort({ recordedAt: -1 })
      .limit(10);

    return NextResponse.json({
      success: true,
      plan,
      metrics,
      telemetry: signals
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to retrieve onboarding plan:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error while retrieving onboarding plan.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
