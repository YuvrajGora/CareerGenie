import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import connectDB from '@/lib/db';
import { evaluateEmployeeRisk, evaluateWorkforceRisks } from '@/services/hrReasoningEngine';

/**
 * POST /api/hr/risks/evaluate
 * Triggers deterministic evaluation across the workforce or for a targeted employee.
 * Persists and updates WorkforceRisk records idempotently.
 * Restricted to 'recruiter' and 'admin' roles.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
      body = {};
    }

    const { employeeId, department, skipGemini } = body;

    if (employeeId) {
      // Targeted evaluation for a single employee
      const risks = await evaluateEmployeeRisk(employeeId, { skipGemini: Boolean(skipGemini) });
      const activeRisks = risks.filter((r) => r.status === 'active');

      let critical = 0;
      let high = 0;
      let medium = 0;
      let low = 0;

      for (const r of activeRisks) {
        if (r.severity === 'critical') critical++;
        else if (r.severity === 'high') high++;
        else if (r.severity === 'medium') medium++;
        else if (r.severity === 'low') low++;
      }

      return NextResponse.json({
        success: true,
        evaluatedEmployees: 1,
        risksDetected: activeRisks.length,
        critical,
        high,
        medium,
        low,
        risks: activeRisks
      }, { status: 200 });
    }

    // Workforce-wide or department-level evaluation
    const summary = await evaluateWorkforceRisks(
      { department },
      { skipGemini: Boolean(skipGemini) }
    );

    return NextResponse.json({
      success: true,
      evaluatedEmployees: summary.evaluatedEmployees,
      risksDetected: summary.risksDetected,
      critical: summary.critical,
      high: summary.high,
      medium: summary.medium,
      low: summary.low,
      timestamp: summary.timestamp
    }, { status: 200 });
  } catch (error: any) {
    console.error('Workforce risk evaluation failed:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error during workforce risk evaluation.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
