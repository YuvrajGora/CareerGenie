import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getEmployeeSkillProfiles, DepartmentName } from '@/services/workforceSkillIntelligenceService';

const VALID_DEPARTMENTS: DepartmentName[] = [
  'Engineering',
  'Product & Design',
  'Sales & Marketing',
  'Operations & HR',
  'Finance'
];

/**
 * GET /api/hr/skills/employees
 * Retrieves employee skill inventory profiles, optionally filtered by department or specific skill.
 * Restricted to recruiter/admin.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const departmentParam = searchParams.get('department') as DepartmentName | null;
    const skillParam = searchParams.get('skill') || undefined;

    if (departmentParam && !VALID_DEPARTMENTS.includes(departmentParam)) {
      return NextResponse.json({
        error: `Invalid department parameter. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`
      }, { status: 400 });
    }

    const profiles = await getEmployeeSkillProfiles(departmentParam || undefined, skillParam);
    return NextResponse.json({ profiles }, { status: 200 });
  } catch (error: any) {
    console.error('Employee skill profiles error:', error);
    return NextResponse.json({
      error: 'Internal server error retrieving employee skill profiles.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
