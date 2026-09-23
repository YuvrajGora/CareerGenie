import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { calculateDepartmentSkillGaps, DepartmentName } from '@/services/workforceSkillIntelligenceService';

const VALID_DEPARTMENTS: DepartmentName[] = [
  'Engineering',
  'Product & Design',
  'Sales & Marketing',
  'Operations & HR',
  'Finance'
];

/**
 * GET /api/hr/skills/gaps
 * Retrieves detailed skill gap analysis for a specific department.
 * Restricted to recruiter/admin.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const departmentParam = (searchParams.get('department') || 'Engineering') as DepartmentName;
    const severityParam = searchParams.get('severity');

    if (!VALID_DEPARTMENTS.includes(departmentParam)) {
      return NextResponse.json({
        error: `Invalid department parameter. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`
      }, { status: 400 });
    }

    const analysis = await calculateDepartmentSkillGaps(departmentParam);

    let filteredSkills = analysis.skills;
    if (severityParam && ['critical', 'moderate', 'healthy'].includes(severityParam)) {
      filteredSkills = filteredSkills.filter((s: any) => s.severity === severityParam);
    }

    return NextResponse.json({
      success: true,
      department: analysis.department,
      capabilityScore: analysis.capabilityScore,
      employeeCount: analysis.employeeCount,
      skills: filteredSkills,
      data: filteredSkills
    }, { status: 200 });
  } catch (error: any) {
    console.error('Skill gaps error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error calculating skill gaps.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
