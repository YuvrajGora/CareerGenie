import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import connectDB from '@/lib/db';
import WorkforceRisk from '@/models/WorkforceRisk';
import Employee from '@/models/Employee';

/**
 * GET /api/hr/risks
 * Retrieves workforce risks with filters for severity, riskType, department, and status.
 * Restricted to 'recruiter' and 'admin' roles.
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const severity = searchParams.get('severity');
    const riskType = searchParams.get('riskType');
    const department = searchParams.get('department');
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 100;

    const query: Record<string, any> = {};

    if (statusParam && statusParam !== 'all') {
      query.status = statusParam;
    } else if (!statusParam) {
      query.status = 'active';
    }

    if (severity && severity !== 'all') {
      query.severity = severity;
    }

    if (riskType && riskType !== 'all') {
      query.riskType = riskType;
    }

    // If department filter is specified, query employees first
    if (department && department !== 'all') {
      const matchingEmployees = await Employee.find({ department: department as any }).select('_id');
      const employeeIds = matchingEmployees.map((e) => e._id);
      query.employeeId = { $in: employeeIds };
    }

    const risks = await WorkforceRisk.find(query)
      .populate({
        path: 'employeeId',
        select: 'name email employeeCode department roleTitle level performanceRating flightRiskLevel skills joiningDate location'
      })
      .sort({ score: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    // Compute aggregated summary metrics across all active risks
    const allActiveRisks = await WorkforceRisk.find({ status: 'active' })
      .populate({
        path: 'employeeId',
        select: 'department'
      })
      .lean();

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    const departmentCounts: Record<string, number> = {};
    const riskTypeCounts: Record<string, number> = {
      burnout: 0,
      attrition: 0,
      disengagement: 0,
      skill_stagnation: 0
    };

    const uniqueEmployeesWithRisk = new Set<string>();

    for (const r of allActiveRisks) {
      if (r.severity === 'critical') criticalCount++;
      else if (r.severity === 'high') highCount++;
      else if (r.severity === 'medium') mediumCount++;
      else if (r.severity === 'low') lowCount++;

      if (r.riskType && riskTypeCounts[r.riskType] !== undefined) {
        riskTypeCounts[r.riskType]++;
      }

      if (r.employeeId) {
        const emp = r.employeeId as any;
        if (emp._id) {
          uniqueEmployeesWithRisk.add(emp._id.toString());
        }
        const dept = emp.department || 'Other';
        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
      }
    }

    const totalActiveEmployees = await Employee.countDocuments({ status: 'active' });

    return NextResponse.json({
      success: true,
      totalRisks: risks.length,
      risks,
      summary: {
        totalEvaluatedEmployees: totalActiveEmployees,
        totalActiveRisks: allActiveRisks.length,
        employeesAtRisk: uniqueEmployeesWithRisk.size,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        departmentBreakdown: departmentCounts,
        riskTypeBreakdown: riskTypeCounts
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to fetch workforce risks:', error);
    return NextResponse.json({
      error: 'Internal server error while retrieving workforce risks.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
