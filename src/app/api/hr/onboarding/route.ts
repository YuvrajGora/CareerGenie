import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { getOnboardingPlans } from '@/services/onboardingOrchestratorService';

/**
 * GET /api/hr/onboarding
 * Retrieves all employee onboarding plans with department, status, and search filters.
 * Returns summary KPIs (active onboarding count, on-track %, delayed count, avg completion, avg velocity).
 * Restricted to 'recruiter' and 'admin' roles. Students receive 403 Forbidden.
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const eligible = searchParams.get('eligible');

    if (eligible === 'true') {
      const connectDB = (await import('@/lib/db')).default;
      const OnboardingPlan = (await import('@/models/OnboardingPlan')).default;
      const Employee = (await import('@/models/Employee')).default;
      await connectDB();

      const existingEmployeeIds = (await OnboardingPlan.find({}).select('employeeId')).map((p) => p.employeeId);
      const eligibleEmployees = await Employee.find({
        _id: { $nin: existingEmployeeIds },
        status: { $ne: 'terminated' }
      })
        .select('name employeeCode department roleTitle level joiningDate managerName status')
        .sort({ name: 1 })
        .lean();

      return NextResponse.json({
        success: true,
        eligibleEmployees
      }, { status: 200 });
    }

    const department = searchParams.get('department') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 100;

    const result = await getOnboardingPlans({
      department: department === 'all' ? undefined : department,
      status: status === 'all' ? undefined : status,
      search,
      limit
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      total: result.plans.length,
      plans: result.plans
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to retrieve onboarding plans:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error while retrieving onboarding plans.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
