import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getDepartmentCapabilityMatrix, DepartmentName } from '@/services/workforceSkillIntelligenceService';

const VALID_DEPARTMENTS: DepartmentName[] = [
  'Engineering',
  'Product & Design',
  'Sales & Marketing',
  'Operations & HR',
  'Finance'
];

/**
 * GET /api/hr/skills/matrix
 * Retrieves the department capability matrix across all departments or a single filtered department.
 * Restricted to recruiter/admin.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const departmentParam = searchParams.get('department') as DepartmentName | null;

    if (departmentParam && !VALID_DEPARTMENTS.includes(departmentParam)) {
      return NextResponse.json({
        error: `Invalid department parameter. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`
      }, { status: 400 });
    }

    const matrix = await getDepartmentCapabilityMatrix(departmentParam || undefined);
    return NextResponse.json({
      success: true,
      matrix,
      data: matrix
    }, { status: 200 });
  } catch (error: any) {
    console.error('Department capability matrix error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error retrieving department capability matrix.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
