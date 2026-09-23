import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import {
  calculateDepartmentSkillGaps,
  normalizeSkillName,
  DepartmentName
} from '@/services/workforceSkillIntelligenceService';
import { generateSkillGapExplanation } from '@/services/gemini';

const VALID_DEPARTMENTS: DepartmentName[] = [
  'Engineering',
  'Product & Design',
  'Sales & Marketing',
  'Operations & HR',
  'Finance'
];

/**
 * GET /api/hr/skills/explain
 * Generates an evidence-grounded AI strategic explanation for a documented skill gap.
 * Restricted to recruiter/admin.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const departmentParam = searchParams.get('department') as DepartmentName;
    const skillNameParam = searchParams.get('skillName');

    if (!departmentParam || !VALID_DEPARTMENTS.includes(departmentParam)) {
      return NextResponse.json({
        error: `Valid department parameter is required. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`
      }, { status: 400 });
    }

    if (!skillNameParam || skillNameParam.trim().length === 0) {
      return NextResponse.json({
        error: 'skillName parameter is required.'
      }, { status: 400 });
    }

    const normalizedTarget = normalizeSkillName(skillNameParam);
    const analysis = await calculateDepartmentSkillGaps(departmentParam);

    const gapItem = analysis.skills.find(
      (s: any) => normalizeSkillName(s.skillName) === normalizedTarget
    );

    if (!gapItem) {
      return NextResponse.json({
        error: `Skill "${skillNameParam}" not found in ${departmentParam} requirements.`
      }, { status: 404 });
    }

    const explanation = await generateSkillGapExplanation({
      skillName: gapItem.skillName,
      department: gapItem.department,
      gapMetrics: {
        targetCoverage: gapItem.targetCoverage,
        verifiedCount: gapItem.verifiedCount,
        availableCount: gapItem.availableCount,
        severity: gapItem.severity,
        criticality: gapItem.criticality,
        hasCompoundRisk: gapItem.hasCompoundRisk
      },
      coveredEmployees: (gapItem.employeesCovering || []).map((e: any) => ({
        name: e.name,
        roleTitle: e.roleTitle,
        proficiency: e.proficiency,
        verified: e.verified,
        hasActiveRisk: e.hasActiveRisk,
        riskType: e.riskType
      })),
      upskillingCandidates: (gapItem.upskillingCandidates || []).map((u: any) => ({
        name: u.name,
        roleTitle: u.roleTitle,
        adjacentSkills: u.adjacentSkills,
        readinessScore: u.readinessScore
      })),
      recruitmentOpportunity: gapItem.recruitmentOpportunity
        ? {
            jobTitle: gapItem.recruitmentOpportunity.jobTitle,
            candidateCount: gapItem.recruitmentOpportunity.matchingCandidatesCount,
            topCandidates: gapItem.recruitmentOpportunity.topCandidates
          }
        : undefined
    });

    return NextResponse.json({
      success: true,
      explanation,
      data: explanation,
      gap: gapItem
    }, { status: 200 });

  } catch (error: any) {
    console.error('Skill gap explanation error:', error);
    return NextResponse.json({
      error: 'Internal server error generating skill gap explanation.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);

/**
 * POST /api/hr/skills/explain
 * Accepts pre-fetched gap item directly for high-performance instant briefings.
 */
export const POST = withAuth(async (req: any) => {
  try {
    const body = await req.json();
    const gap = body.gap;

    if (!gap) {
      return NextResponse.json({
        error: 'gap object is required in request body.'
      }, { status: 400 });
    }

    const explanation = await generateSkillGapExplanation(gap);

    return NextResponse.json({
      success: true,
      explanation,
      data: explanation,
      gap
    }, { status: 200 });
  } catch (error: any) {
    console.error('Skill gap explanation error (POST):', error);
    return NextResponse.json({
      error: 'Internal server error generating skill gap explanation.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
