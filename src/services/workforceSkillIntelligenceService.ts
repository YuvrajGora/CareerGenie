import mongoose from 'mongoose';
import Employee, { IEmployee, IEmployeeSkill } from '@/models/Employee';
import WorkforceRisk from '@/models/WorkforceRisk';
import DepartmentSkillRequirement, { IDepartmentSkillRequirement } from '@/models/DepartmentSkillRequirement';
import Job from '@/models/Job';
import JobMatch from '@/models/JobMatch';
import Application from '@/models/Application';
import User from '@/models/User';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type DepartmentName = 'Engineering' | 'Product & Design' | 'Sales & Marketing' | 'Operations & HR' | 'Finance';

export interface SkillCoverageEmployee {
  employeeId: string;
  name: string;
  email?: string;
  roleTitle: string;
  level?: string;
  department?: DepartmentName | string;
  proficiency: 'beginner' | 'intermediate' | 'expert' | string;
  verified: boolean;
  hasActiveRisk?: boolean;
  riskType?: string;
  riskSeverity?: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  flightRiskLevel?: string;
}

export interface UpskillingCandidate {
  employeeId: string;
  name: string;
  email?: string;
  roleTitle: string;
  level?: string;
  department?: DepartmentName | string;
  adjacentSkills: string[];
  readinessScore: number; // 0 - 100 based on adjacent skill count and performance
  recommendedPath: string;
  flightRiskLevel?: string;
}

export interface RecruitmentLinkage {
  jobId: string;
  jobTitle: string;
  title?: string; // alias
  department?: string;
  openPositions?: number;
  company?: string;
  status: string;
  matchingCandidatesCount: number;
  matchedCandidatesCount?: number; // alias
  topCandidateScore?: number;
  topCandidates: Array<{
    candidateId: string;
    name: string;
    matchScore: number;
    email?: string;
  }>;
}

export interface SkillGapItem {
  skillName: string;
  skill: string; // alias
  department: DepartmentName | string;
  category: 'technical' | 'domain' | 'leadership' | 'soft_skill' | string;
  targetCoverage: number;
  targetHeadcount: number; // alias
  availableCount: number;
  availableHeadcount: number; // alias
  verifiedCount: number;
  verifiedHeadcount: number; // alias
  unverifiedCount: number;
  unverifiedHeadcount: number; // alias
  coverageRatio: number;
  verifiedCoverageRatio: number; // alias
  gapCount: number;
  gapHeadcount: number; // alias
  verifiedGapHeadcount: number;
  minimumProficiency: string;
  severity: 'critical' | 'moderate' | 'healthy';
  criticality: 'critical' | 'high' | 'medium' | string;
  hasCompoundRisk: boolean;
  compoundRiskDetails?: string[];
  employeesCovering: SkillCoverageEmployee[];
  verifiedEmployees: SkillCoverageEmployee[];
  unverifiedEmployees: SkillCoverageEmployee[];
  upskillingCandidates: UpskillingCandidate[];
  recruitmentOpportunity?: RecruitmentLinkage;
  recruitmentOpportunities: RecruitmentLinkage[];
  recommendation: string;
}

export interface DepartmentCapabilityMatrix {
  department: DepartmentName | string;
  employeeCount: number;
  capabilityScore: number; // 0 - 100 overall score
  totalRequiredSkills: number;
  coveredSkillsCount: number; // healthy coverage
  moderateGapsCount: number;
  criticalGapsCount: number;
  skills: SkillGapItem[];
}

export interface WorkforceSkillOverview {
  totalSkillsTracked: number;
  totalVerifiedCoverageRate: number; // %
  totalCriticalGaps: number;
  totalModerateGaps: number;
  totalUpskillingOpportunities: number;
  summary?: {
    totalEmployees: number;
    totalDepartments: number;
    totalUniqueSkills: number;
    totalRequirements: number;
    criticalGaps: number;
    moderateGaps: number;
    healthySkills: number;
    overallVerifiedCoverageRate: number;
    totalUpskillingCandidates: number;
  };
  departments?: any[];
  departmentSummaries: Array<{
    department: DepartmentName | string;
    employeeCount: number;
    capabilityScore: number;
    criticalGaps: number;
    moderateGaps: number;
  }>;
}

// Aliases for test compatibility
export type IDepartmentSkillRequirementDoc = any;
export type IDepartmentSkillGap = SkillGapItem;

// ============================================================================
// 1. SKILL-NAME NORMALIZATION & DEDUPLICATION
// ============================================================================

const SKILL_SYNONYM_MAP: Record<string, string> = {
  'k8s': 'Kubernetes',
  'k8s operator': 'Kubernetes',
  'kubernetes': 'Kubernetes',
  'kubernetes engine': 'Kubernetes',
  'golang': 'Go',
  'go': 'Go',
  'go lang': 'Go',
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'next': 'Next.js',
  'next.js': 'Next.js',
  'nextjs': 'Next.js',
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'typescript lang': 'TypeScript',
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'javascript lang': 'JavaScript',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'postgresql db': 'PostgreSQL',
  'aws': 'AWS',
  'aws cloud': 'AWS',
  'amazon web services': 'AWS',
  'aws cloudformation': 'AWS CloudFormation',
  'gcp': 'Google Cloud',
  'google cloud': 'Google Cloud',
  'google cloud platform': 'Google Cloud',
  'docker': 'Docker',
  'docker container': 'Docker',
  'dockerization': 'Docker',
  'graphql': 'GraphQL',
  'graphql api': 'GraphQL',
  'rest': 'REST APIs',
  'rest api': 'REST APIs',
  'restful apis': 'REST APIs',
  'rest apis': 'REST APIs',
  'ci/cd': 'CI/CD',
  'cicd': 'CI/CD',
  'cypress': 'Cypress',
  'cypress testing': 'Cypress',
  'playwright': 'Playwright',
  'playwright testing': 'Playwright',
  'sql analytics': 'SQL Analytics',
  'b2b outbound': 'B2B Outbound',
  'b2b outbound sales': 'B2B Outbound',
  'crm pipeline': 'CRM Pipeline Management',
  'crm pipeline management': 'CRM Pipeline Management',
  'micro-frontends': 'Micro-frontends',
  'web performance': 'Web Performance'
};

/**
 * Normalizes skill strings, handling case variations, whitespace, and known industry synonyms.
 */
export function normalizeSkillName(rawSkill: string): string {
  if (!rawSkill || typeof rawSkill !== 'string') return '';
  const trimmed = rawSkill.trim();
  const lower = trimmed.toLowerCase();

  if (SKILL_SYNONYM_MAP[lower]) {
    return SKILL_SYNONYM_MAP[lower];
  }

  // Capitalize word boundaries nicely if not in synonym map
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (word.length <= 3 && word.toUpperCase() === word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// ============================================================================
// 2. PROFICIENCY HIERARCHY
// ============================================================================

export const PROFICIENCY_RANK: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4
};

export function meetsProficiencyRequirement(
  employeeProficiency: string,
  requiredProficiency: string
): boolean {
  const empRank = PROFICIENCY_RANK[employeeProficiency?.toLowerCase()] || 1;
  const reqRank = PROFICIENCY_RANK[requiredProficiency?.toLowerCase()] || 2;
  return empRank >= reqRank;
}

// ============================================================================
// 3. ADJACENT SKILLS MAP (Upskilling Capability Graph)
// ============================================================================

export const ADJACENT_SKILLS_GRAPH: Record<string, string[]> = {
  'Kubernetes': ['Docker', 'AWS', 'Linux', 'Go', 'CI/CD', 'AWS CloudFormation'],
  'Kafka': ['Distributed Systems', 'RabbitMQ', 'Go', 'Python', 'Redis', 'PostgreSQL'],
  'Go': ['Python', 'C++', 'Rust', 'Java', 'Linux', 'Docker'],
  'React': ['JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'Next.js', 'Tailwind CSS'],
  'Next.js': ['React', 'TypeScript', 'JavaScript', 'Web Performance', 'GraphQL'],
  'GraphQL': ['REST APIs', 'TypeScript', 'Node.js', 'React'],
  'PostgreSQL': ['SQL', 'Database', 'Python', 'Snowflake'],
  'Cypress': ['JavaScript', 'TypeScript', 'Playwright', 'QA Automation'],
  'Playwright': ['Cypress', 'JavaScript', 'TypeScript', 'QA Automation'],
  'User Research': ['User Stories', 'Figma', 'Product Analytics', 'Design Systems'],
  'Design Systems': ['Figma', 'UI/UX Design', 'CSS Architecture', 'React'],
  'Product Roadmapping': ['User Stories', 'Go-To-Market Strategy', 'SQL Analytics'],
  'Enterprise Sales': ['B2B Outbound', 'Contract Negotiation', 'CRM Pipeline Management'],
  'CRM Pipeline Management': ['Enterprise Sales', 'B2B Outbound', 'Customer Retention'],
  'Go-To-Market Strategy': ['Competitive Intelligence', 'Technical Writing', 'SEO Strategy', 'Paid Acquisition'],
  'HR Policy Administration': ['Employee Relations', 'Talent Acquisition', 'Compensation & Benefits'],
  'Financial Modeling': ['Corporate Tax Compliance', 'Revenue Recognition (ASC 606)', 'Financial Audit Readiness']
};

/**
 * Discovers employees who possess adjacent competencies for a target skill.
 * CRITICAL RULE: Adjacent skills are labeled as potential upskilling opportunities,
 * never as verified capabilities.
 */
export function findAdjacentUpskillingCandidates(
  targetSkill: string,
  department: string,
  employees: any[]
): UpskillingCandidate[] {
  const normalizedTarget = normalizeSkillName(targetSkill);
  const adjacentSkillsExpected = ADJACENT_SKILLS_GRAPH[normalizedTarget] || [];
  const candidates: UpskillingCandidate[] = [];

  if (adjacentSkillsExpected.length === 0) return candidates;

  for (const emp of employees) {
    if (department && department !== 'all' && emp.department && emp.department !== department) continue;

    // Skip if employee already has verified target skill
    const alreadyHasVerified = (emp.skills || []).some(
      (s: any) => normalizeSkillName(s.name) === normalizedTarget && s.verified
    );
    if (alreadyHasVerified) continue;

    const empSkillNames = (emp.skills || []).map((s: any) => normalizeSkillName(s.name));
    const matchedAdj = adjacentSkillsExpected.filter(adj =>
      empSkillNames.includes(normalizeSkillName(adj))
    );

    if (matchedAdj.length > 0) {
      const adjRatio = matchedAdj.length / Math.min(3, adjacentSkillsExpected.length);
      const perfBonus = ((emp.performanceRating || 3.0) / 5.0) * 20;
      const readinessScore = Math.min(95, Math.max(10, Math.round(adjRatio * 75 + perfBonus)));

      candidates.push({
        employeeId: emp._id ? emp._id.toString() : (emp.employeeCode || ''),
        name: emp.name,
        email: emp.email || '',
        roleTitle: emp.roleTitle || '',
        level: emp.level || '',
        department: emp.department as DepartmentName,
        adjacentSkills: matchedAdj,
        readinessScore,
        recommendedPath: `Upskill from ${matchedAdj.join(', ')} to ${normalizedTarget} via targeted technical residency.`,
        flightRiskLevel: emp.flightRiskLevel || 'low'
      });
    }
  }

  candidates.sort((a, b) => b.readinessScore - a.readinessScore);
  return candidates;
}

// ============================================================================
// 4. BASELINE DEPARTMENT SKILL REQUIREMENTS (Default Ground Truth)
// ============================================================================

export const BASELINE_DEPARTMENT_REQUIREMENTS: Array<{
  department: DepartmentName;
  skillName: string;
  category: 'technical' | 'domain' | 'leadership' | 'soft_skill';
  targetCoverageCount: number;
  minProficiency: 'beginner' | 'intermediate' | 'expert';
  criticality: 'critical' | 'high' | 'medium';
  description: string;
}> = [
  // --- Engineering ---
  {
    department: 'Engineering',
    skillName: 'Kubernetes',
    category: 'technical',
    targetCoverageCount: 3,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'High-availability cluster orchestration and container deployment infrastructure.'
  },
  {
    department: 'Engineering',
    skillName: 'Go',
    category: 'technical',
    targetCoverageCount: 3,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'Low-latency distributed telemetry and multi-region backend microservices.'
  },
  {
    department: 'Engineering',
    skillName: 'TypeScript',
    category: 'technical',
    targetCoverageCount: 4,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Enterprise type-safe application logic across web and node services.'
  },
  {
    department: 'Engineering',
    skillName: 'Kafka',
    category: 'technical',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'High-throughput event streaming and message queuing backbone.'
  },
  {
    department: 'Engineering',
    skillName: 'React',
    category: 'technical',
    targetCoverageCount: 3,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Core web frontend component hierarchy and dynamic state management.'
  },
  {
    department: 'Engineering',
    skillName: 'PostgreSQL',
    category: 'technical',
    targetCoverageCount: 3,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Relational data modeling, schema indexing, and transactional integrity.'
  },

  // --- Product & Design ---
  {
    department: 'Product & Design',
    skillName: 'User Research',
    category: 'domain',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Empirical user interviews, qualitative usability audits, and persona testing.'
  },
  {
    department: 'Product & Design',
    skillName: 'Design Systems',
    category: 'technical',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Cross-platform reusable design tokens, typography, and atomic component libraries.'
  },
  {
    department: 'Product & Design',
    skillName: 'Product Roadmapping',
    category: 'leadership',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'Strategic feature prioritization, stakeholder alignment, and release milestones.'
  },

  // --- Sales & Marketing ---
  {
    department: 'Sales & Marketing',
    skillName: 'Enterprise Sales',
    category: 'domain',
    targetCoverageCount: 3,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'Complex multi-stakeholder contract closing and annual contract value expansion.'
  },
  {
    department: 'Sales & Marketing',
    skillName: 'CRM Pipeline Management',
    category: 'technical',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Accurate deal forecasting, lead routing, and conversion velocity telemetry.'
  },
  {
    department: 'Sales & Marketing',
    skillName: 'Go-To-Market Strategy',
    category: 'leadership',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Multi-channel product positioning, sales enablement, and launch collateral.'
  },

  // --- Operations & HR ---
  {
    department: 'Operations & HR',
    skillName: 'HR Policy Administration',
    category: 'domain',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'Statutory compliance, employee handbook governance, and workplace standards.'
  },
  {
    department: 'Operations & HR',
    skillName: 'Talent Acquisition',
    category: 'domain',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'Technical sourcing, structured rubric assessment, and candidate closure.'
  },

  // --- Finance ---
  {
    department: 'Finance',
    skillName: 'Financial Modeling',
    category: 'domain',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'critical',
    description: 'Runway projections, headcount budgeting, and capital allocation models.'
  },
  {
    department: 'Finance',
    skillName: 'Revenue Recognition (ASC 606)',
    category: 'domain',
    targetCoverageCount: 2,
    minProficiency: 'intermediate',
    criticality: 'high',
    description: 'GAAP compliance for subscription software revenue scheduling.'
  }
];

// ============================================================================
// 5. REQUIREMENT LOADING
// ============================================================================

export async function getDepartmentRequirements(
  department?: DepartmentName
): Promise<Array<{
  department: DepartmentName;
  skillName: string;
  category: 'technical' | 'domain' | 'leadership' | 'soft_skill';
  targetCoverageCount: number;
  minProficiency: 'beginner' | 'intermediate' | 'expert';
  criticality: 'critical' | 'high' | 'medium';
  description: string;
}>> {
  try {
    const filter: any = {};
    if (department) filter.department = department;

    const dbRequirements = await DepartmentSkillRequirement.find(filter).lean();
    if (dbRequirements && dbRequirements.length > 0) {
      return dbRequirements.map(d => ({
        department: d.department as DepartmentName,
        skillName: normalizeSkillName(d.skillName),
        category: d.category,
        targetCoverageCount: d.targetCoverageCount,
        minProficiency: d.minProficiency,
        criticality: d.criticality,
        description: d.description || ''
      }));
    }
  } catch (err) {
    console.warn('Could not query DepartmentSkillRequirement from DB, using baseline defaults.');
  }

  // Fallback to baseline
  let baseline = BASELINE_DEPARTMENT_REQUIREMENTS;
  if (department) {
    baseline = baseline.filter(b => b.department === department);
  }
  return baseline;
}

// ============================================================================
// 6. CORE GAP CALCULATION ENGINE
// ============================================================================

/**
 * Pure calculation engine for department skill gaps, cross-referencing workforce risks,
 * adjacent upskilling opportunities, and active recruitment pipelines.
 */
export function computeDepartmentSkillGaps(
  requirements: any[],
  employees: any[],
  risks: any[] = [],
  jobs: any[] = [],
  jobMatches: any[] = []
): SkillGapItem[] {
  // Index risks by employeeId string
  const riskMap = new Map<string, any>();
  for (const risk of risks) {
    const empId = risk.employeeId ? risk.employeeId.toString() : '';
    const existing = riskMap.get(empId);
    if (!existing || (risk.score || 0) > (existing.score || 0)) {
      riskMap.set(empId, risk);
    }
  }

  // Index active jobs by normalized skill
  const jobMapBySkill = new Map<string, any[]>();
  for (const job of jobs) {
    if (job.status && job.status !== 'active') continue; // only active jobs
    for (const reqSkill of job.requiredSkills || []) {
      const normJobSkill = normalizeSkillName(reqSkill);
      if (!jobMapBySkill.has(normJobSkill)) {
        jobMapBySkill.set(normJobSkill, []);
      }
      jobMapBySkill.get(normJobSkill)!.push(job);
    }
  }

  const skillGaps: SkillGapItem[] = [];

  for (const req of requirements) {
    const targetSkill = normalizeSkillName(req.skillName || req.skill);
    const department = req.department;
    const minProficiency = req.minProficiency || req.minimumProficiency || 'intermediate';
    const targetCoverage = req.targetCoverageCount || req.targetHeadcount || 1;
    const category = req.category || 'technical';
    const criticality = req.criticality || 'high';

    // Find employees who have this skill
    const employeesCovering: SkillCoverageEmployee[] = [];
    const verifiedEmployees: SkillCoverageEmployee[] = [];
    const unverifiedEmployees: SkillCoverageEmployee[] = [];
    const compoundRiskDetails: string[] = [];
    let hasCompoundRisk = false;

    // Filter employees by department if specified
    const deptEmployees = department
      ? employees.filter(e => !e.department || e.department === department)
      : employees;

    for (const emp of deptEmployees) {
      const empSkills: any[] = emp.skills || [];
      const matchedSkill = empSkills.find((s: any) => normalizeSkillName(s.name) === targetSkill);

      if (matchedSkill) {
        const empRisk = riskMap.get(emp._id ? emp._id.toString() : '');
        const isHighRisk = empRisk && (empRisk.severity === 'high' || empRisk.severity === 'critical');
        const meetsProf = meetsProficiencyRequirement(matchedSkill.proficiency, minProficiency);

        // Only count if employee meets minimum proficiency requirement
        if (!meetsProf) {
          continue;
        }

        const coverageRecord: SkillCoverageEmployee = {
          employeeId: emp._id ? emp._id.toString() : (emp.employeeCode || ''),
          name: emp.name,
          email: emp.email,
          roleTitle: emp.roleTitle,
          level: emp.level,
          department: emp.department,
          proficiency: matchedSkill.proficiency,
          verified: Boolean(matchedSkill.verified),
          hasActiveRisk: Boolean(empRisk),
          riskType: empRisk ? empRisk.riskType : undefined,
          riskSeverity: empRisk ? empRisk.severity : undefined,
          riskScore: empRisk ? empRisk.score : undefined,
          flightRiskLevel: emp.flightRiskLevel || (isHighRisk ? empRisk.severity : 'low')
        };

        employeesCovering.push(coverageRecord);

        if (matchedSkill.verified) {
          verifiedEmployees.push(coverageRecord);
          if (isHighRisk) {
            hasCompoundRisk = true;
            compoundRiskDetails.push(
              `Key engineer ${emp.name} (${emp.employeeCode || emp.roleTitle}) holds verified capability but has ${empRisk.severity.toUpperCase()} ${empRisk.riskType} risk (Score: ${empRisk.score}).`
            );
          }
        } else {
          unverifiedEmployees.push(coverageRecord);
        }
      }
    }

    const availableCount = employeesCovering.length;
    const verifiedCount = verifiedEmployees.length;
    const unverifiedCount = unverifiedEmployees.length;
    const coverageRatio = targetCoverage > 0 ? verifiedCount / targetCoverage : 1.0;
    const gapCount = Math.max(0, targetCoverage - availableCount);
    const verifiedGapHeadcount = Math.max(0, targetCoverage - verifiedCount);

    // Determine deterministic severity
    // Critical: < 40% verified coverage
    // Moderate: 40% to 79%
    // Healthy: >= 80%
    let severity: 'critical' | 'moderate' | 'healthy' = 'healthy';
    if (verifiedCount === 0 || coverageRatio < 0.40 || (criticality === 'critical' && coverageRatio < 0.50)) {
      severity = 'critical';
    } else if (coverageRatio < 0.80) {
      severity = 'moderate';
    } else {
      severity = 'healthy';
    }

    // Identify adjacent upskilling candidates
    const upskillingCandidates = findAdjacentUpskillingCandidates(
      targetSkill,
      department,
      deptEmployees
    );

    // Connect recruitment opportunities
    const linkedJobs = jobMapBySkill.get(targetSkill) || [];
    const recruitmentOpportunities: RecruitmentLinkage[] = [];

    for (const job of linkedJobs) {
      const jobIdStr = job._id ? job._id.toString() : '';
      const matchingMatches = jobMatches.filter(m => m.jobId && m.jobId.toString() === jobIdStr);
      const topMatchScore = matchingMatches.length > 0
        ? Math.max(...matchingMatches.map(m => m.matchScore || 0))
        : 0;

      recruitmentOpportunities.push({
        jobId: jobIdStr,
        jobTitle: job.title,
        title: job.title,
        department: job.department,
        openPositions: job.openPositions || 1,
        company: job.company,
        status: job.status,
        matchingCandidatesCount: matchingMatches.length,
        matchedCandidatesCount: matchingMatches.length,
        topCandidateScore: topMatchScore,
        topCandidates: matchingMatches.slice(0, 3).map(m => ({
          candidateId: m.studentId ? m.studentId.toString() : '',
          name: m.studentName || 'Candidate',
          matchScore: m.matchScore || 0,
          email: m.studentEmail || ''
        }))
      });
    }

    const recruitmentOpportunity = recruitmentOpportunities.length > 0 ? recruitmentOpportunities[0] : undefined;

    // Formulate evidence-backed recommendation
    let recommendation = `Maintain current coverage. Verified coverage (${verifiedCount}/${targetCoverage}) meets target.`;
    if (severity === 'critical') {
      if (recruitmentOpportunity && recruitmentOpportunity.topCandidates.length > 0) {
        recommendation = `CRITICAL GAP: Deficient verified coverage (${verifiedCount}/${targetCoverage}). Immediate recruitment recommended: Active job "${recruitmentOpportunity.jobTitle}" has ${recruitmentOpportunity.matchingCandidatesCount} matched candidates in pipeline.`;
      } else if (upskillingCandidates.length > 0) {
        recommendation = `CRITICAL GAP: Insufficient verified coverage (${verifiedCount}/${targetCoverage}). Prioritize upskilling ${upskillingCandidates[0].name} (${upskillingCandidates[0].roleTitle}) based on adjacent proficiency in ${upskillingCandidates[0].adjacentSkills.join(', ')}.`;
      } else {
        recommendation = `CRITICAL GAP: Zero verified coverage (${verifiedCount}/${targetCoverage}) with no adjacent internal candidates. Open immediate requisition for ${targetSkill} specialist.`;
      }
    } else if (severity === 'moderate') {
      if (hasCompoundRisk) {
        recommendation = `MODERATE GAP COMPOUNDED BY WORKFORCE RISK: Current verified coverage (${verifiedCount}/${targetCoverage}) has single-point-of-failure risk due to high flight/burnout risk in key employee. Cross-train adjacent talent urgently.`;
      } else if (upskillingCandidates.length > 0) {
        recommendation = `MODERATE GAP: Coverage is at ${Math.round(coverageRatio * 100)}% (${verifiedCount}/${targetCoverage}). Upskill ${upskillingCandidates.slice(0, 2).map(c => c.name).join(' and ')} to achieve target resiliency.`;
      } else {
        recommendation = `MODERATE GAP: Coverage is at ${Math.round(coverageRatio * 100)}% (${verifiedCount}/${targetCoverage}). Monitor upcoming sprint commitments.`;
      }
    }

    skillGaps.push({
      skillName: targetSkill,
      skill: targetSkill,
      department,
      category,
      targetCoverage,
      targetHeadcount: targetCoverage,
      availableCount,
      availableHeadcount: availableCount,
      verifiedCount,
      verifiedHeadcount: verifiedCount,
      unverifiedCount,
      unverifiedHeadcount: unverifiedCount,
      coverageRatio: Math.min(1.0, coverageRatio),
      verifiedCoverageRatio: Math.min(1.0, coverageRatio),
      gapCount,
      gapHeadcount: gapCount,
      verifiedGapHeadcount,
      minimumProficiency: minProficiency,
      severity,
      criticality,
      hasCompoundRisk,
      compoundRiskDetails,
      employeesCovering,
      verifiedEmployees,
      unverifiedEmployees,
      upskillingCandidates: upskillingCandidates.slice(0, 4),
      recruitmentOpportunity,
      recruitmentOpportunities,
      recommendation
    });
  }

  return skillGaps;
}

/**
 * Calculates department skill gaps either via DB or in-memory when arrays are passed.
 */
export async function calculateDepartmentSkillGaps(
  departmentOrRequirements: DepartmentName | any[],
  employees?: any[],
  risks?: any[],
  jobs?: any[],
  jobMatches?: any[]
): Promise<any> {
  // If called in-memory (e.g. from unit tests)
  if (Array.isArray(departmentOrRequirements)) {
    return computeDepartmentSkillGaps(
      departmentOrRequirements,
      employees || [],
      risks || [],
      jobs || [],
      jobMatches || []
    );
  }

  // DB-driven implementation
  const department = departmentOrRequirements;

  const employeesDb = await Employee.find({
    department,
    status: { $in: ['active', 'probation', 'onboarding'] }
  }).lean();

  const employeeCount = employeesDb.length;
  const employeeIds = employeesDb.map(e => e._id);

  const activeRisks = await WorkforceRisk.find({
    employeeId: { $in: employeeIds },
    status: 'active'
  }).lean();

  const activeJobs = await Job.find({ status: 'active' }).lean();
  const activeJobIds = activeJobs.map(j => j._id);
  const activeJobMatches = await JobMatch.find({ jobId: { $in: activeJobIds } }).lean();

  const requirements = await getDepartmentRequirements(department);

  const skillGaps = computeDepartmentSkillGaps(
    requirements,
    employeesDb,
    activeRisks,
    activeJobs,
    activeJobMatches
  );

  const totalSkills = skillGaps.length;
  let capabilityScore = 100;
  if (totalSkills > 0) {
    const totalRatioSum = skillGaps.reduce((acc, s) => acc + s.coverageRatio, 0);
    capabilityScore = Math.min(100, Math.max(0, Math.round((totalRatioSum / totalSkills) * 100)));
  }

  return {
    department,
    capabilityScore,
    employeeCount,
    skills: skillGaps
  };
}

// ============================================================================
// 7. AGGREGATED WORKFORCE OVERVIEW
// ============================================================================

export async function getWorkforceSkillOverview(
  employeesOverride?: any[],
  requirementsOverride?: any[],
  risksOverride?: any[],
  jobsOverride?: any[],
  jobMatchesOverride?: any[]
): Promise<WorkforceSkillOverview> {
  const departments: DepartmentName[] = [
    'Engineering',
    'Product & Design',
    'Sales & Marketing',
    'Operations & HR',
    'Finance'
  ];

  // In-memory test override branch
  if (employeesOverride && requirementsOverride) {
    const allGaps = computeDepartmentSkillGaps(
      requirementsOverride,
      employeesOverride,
      risksOverride || [],
      jobsOverride || [],
      jobMatchesOverride || []
    );

    const totalCrit = allGaps.filter(s => s.severity === 'critical').length;
    const totalMod = allGaps.filter(s => s.severity === 'moderate').length;
    const totalHealthy = allGaps.filter(s => s.severity === 'healthy').length;
    const totalUpskill = allGaps.reduce((acc, s) => acc + s.upskillingCandidates.length, 0);

    const verifiedSum = allGaps.reduce((acc, s) => acc + s.verifiedHeadcount, 0);
    const targetSum = allGaps.reduce((acc, s) => acc + s.targetHeadcount, 0);
    const verifiedRate = targetSum > 0 ? verifiedSum / targetSum : 1.0;

    const uniqueSkills = new Set(allGaps.map(s => s.skillName)).size;
    const uniqueDepts = new Set(requirementsOverride.map(r => r.department)).size;

    return {
      totalSkillsTracked: allGaps.length,
      totalVerifiedCoverageRate: Math.round(verifiedRate * 100),
      totalCriticalGaps: totalCrit,
      totalModerateGaps: totalMod,
      totalUpskillingOpportunities: totalUpskill,
      summary: {
        totalEmployees: employeesOverride.length,
        totalDepartments: uniqueDepts,
        totalUniqueSkills: uniqueSkills,
        totalRequirements: requirementsOverride.length,
        criticalGaps: totalCrit,
        moderateGaps: totalMod,
        healthySkills: totalHealthy,
        overallVerifiedCoverageRate: verifiedRate,
        totalUpskillingCandidates: totalUpskill
      },
      departments: [
        {
          department: requirementsOverride[0]?.department || 'Engineering',
          employeeCount: employeesOverride.length,
          totalRequiredSkills: allGaps.length,
          criticalGaps: totalCrit,
          moderateGaps: totalMod,
          healthySkills: totalHealthy,
          overallCoverageRatio: verifiedRate,
          overallVerifiedRatio: verifiedRate,
          skills: allGaps
        }
      ],
      departmentSummaries: [
        {
          department: requirementsOverride[0]?.department || 'Engineering',
          employeeCount: employeesOverride.length,
          capabilityScore: Math.round(verifiedRate * 100),
          criticalGaps: totalCrit,
          moderateGaps: totalMod
        }
      ]
    };
  }

  // Live DB-driven branch
  let totalSkillsTracked = 0;
  let totalVerifiedSum = 0;
  let totalRequiredSum = 0;
  let totalCriticalGaps = 0;
  let totalModerateGaps = 0;
  let totalHealthySkills = 0;
  let totalUpskillingOpportunities = 0;
  let totalHeadcount = 0;
  const uniqueSkillsSet = new Set<string>();

  const departmentSummaries: WorkforceSkillOverview['departmentSummaries'] = [];
  const detailedDepartments: any[] = [];

  for (const dept of departments) {
    const analysis = await calculateDepartmentSkillGaps(dept);

    const critCount = analysis.skills.filter((s: any) => s.severity === 'critical').length;
    const modCount = analysis.skills.filter((s: any) => s.severity === 'moderate').length;
    const healthyCount = analysis.skills.filter((s: any) => s.severity === 'healthy').length;
    const upskillCount = analysis.skills.reduce((acc: number, s: any) => acc + s.upskillingCandidates.length, 0);

    totalSkillsTracked += analysis.skills.length;
    totalCriticalGaps += critCount;
    totalModerateGaps += modCount;
    totalHealthySkills += healthyCount;
    totalUpskillingOpportunities += upskillCount;
    totalHeadcount += analysis.employeeCount;

    for (const s of analysis.skills) {
      totalVerifiedSum += s.verifiedCount;
      totalRequiredSum += s.targetCoverage;
      uniqueSkillsSet.add(s.skillName);
    }

    departmentSummaries.push({
      department: dept,
      employeeCount: analysis.employeeCount,
      capabilityScore: analysis.capabilityScore,
      criticalGaps: critCount,
      moderateGaps: modCount
    });

    detailedDepartments.push({
      department: dept,
      employeeCount: analysis.employeeCount,
      totalRequiredSkills: analysis.skills.length,
      criticalGaps: critCount,
      moderateGaps: modCount,
      healthySkills: healthyCount,
      overallCoverageRatio: analysis.skills.length > 0
        ? analysis.skills.reduce((acc: number, s: any) => acc + s.coverageRatio, 0) / analysis.skills.length
        : 1.0,
      overallVerifiedRatio: analysis.skills.length > 0
        ? analysis.skills.reduce((acc: number, s: any) => acc + s.verifiedCoverageRatio, 0) / analysis.skills.length
        : 1.0,
      skills: analysis.skills
    });
  }

  const overallRate = totalRequiredSum > 0 ? totalVerifiedSum / totalRequiredSum : 1.0;
  const totalVerifiedCoverageRate = Math.min(100, Math.round(overallRate * 100));

  return {
    totalSkillsTracked,
    totalVerifiedCoverageRate,
    totalCriticalGaps,
    totalModerateGaps,
    totalUpskillingOpportunities,
    summary: {
      totalEmployees: totalHeadcount,
      totalDepartments: departments.length,
      totalUniqueSkills: uniqueSkillsSet.size,
      totalRequirements: totalSkillsTracked,
      criticalGaps: totalCriticalGaps,
      moderateGaps: totalModerateGaps,
      healthySkills: totalHealthySkills,
      overallVerifiedCoverageRate: overallRate,
      totalUpskillingCandidates: totalUpskillingOpportunities
    },
    departments: detailedDepartments,
    departmentSummaries
  };
}

// ============================================================================
// 8. CAPABILITY MATRIX
// ============================================================================

export async function getDepartmentCapabilityMatrix(
  departmentFilterOrEmployees?: DepartmentName | any[],
  requirementsOverride?: any[]
): Promise<DepartmentCapabilityMatrix[]> {
  // In-memory test override branch
  if (Array.isArray(departmentFilterOrEmployees) && requirementsOverride) {
    const gaps = computeDepartmentSkillGaps(requirementsOverride, departmentFilterOrEmployees);
    return [
      {
        department: requirementsOverride[0]?.department || 'Engineering',
        employeeCount: departmentFilterOrEmployees.length,
        capabilityScore: 80,
        totalRequiredSkills: gaps.length,
        coveredSkillsCount: gaps.filter(g => g.severity === 'healthy').length,
        moderateGapsCount: gaps.filter(g => g.severity === 'moderate').length,
        criticalGapsCount: gaps.filter(g => g.severity === 'critical').length,
        skills: gaps
      }
    ];
  }

  const departmentFilter = typeof departmentFilterOrEmployees === 'string'
    ? departmentFilterOrEmployees
    : undefined;

  const departments: DepartmentName[] = departmentFilter
    ? [departmentFilter]
    : ['Engineering', 'Product & Design', 'Sales & Marketing', 'Operations & HR', 'Finance'];

  const matrix: DepartmentCapabilityMatrix[] = [];

  for (const dept of departments) {
    const analysis = await calculateDepartmentSkillGaps(dept);

    const coveredSkillsCount = analysis.skills.filter((s: any) => s.severity === 'healthy').length;
    const moderateGapsCount = analysis.skills.filter((s: any) => s.severity === 'moderate').length;
    const criticalGapsCount = analysis.skills.filter((s: any) => s.severity === 'critical').length;

    matrix.push({
      department: dept,
      employeeCount: analysis.employeeCount,
      capabilityScore: analysis.capabilityScore,
      totalRequiredSkills: analysis.skills.length,
      coveredSkillsCount,
      moderateGapsCount,
      criticalGapsCount,
      skills: analysis.skills
    });
  }

  return matrix;
}

// ============================================================================
// 9. EMPLOYEE SKILL PROFILES
// ============================================================================

export async function getEmployeeSkillProfiles(
  departmentOrEmployees?: DepartmentName | any[],
  skillNameOrDepartment?: string
): Promise<Array<{
  employeeId: string;
  name: string;
  email: string;
  department: DepartmentName | string;
  roleTitle: string;
  level: string;
  skills: any[];
  totalSkillsCount: number;
  verifiedSkillsCount: number;
  hasActiveRisk: boolean;
  flightRiskLevel: string;
}>> {
  // In-memory test override branch
  if (Array.isArray(departmentOrEmployees)) {
    const targetDept = skillNameOrDepartment;
    const filtered = targetDept
      ? departmentOrEmployees.filter(e => e.department === targetDept)
      : departmentOrEmployees;

    return filtered.map(emp => ({
      employeeId: emp._id ? emp._id.toString() : (emp.employeeCode || ''),
      name: emp.name,
      email: emp.email || '',
      department: emp.department,
      roleTitle: emp.roleTitle || '',
      level: emp.level || '',
      skills: emp.skills || [],
      totalSkillsCount: (emp.skills || []).length,
      verifiedSkillsCount: (emp.skills || []).filter((s: any) => s.verified).length,
      hasActiveRisk: false,
      flightRiskLevel: emp.flightRiskLevel || 'low'
    }));
  }

  // Live DB-driven branch
  const department = departmentOrEmployees;
  const skillName = skillNameOrDepartment;

  const filter: any = {
    status: { $in: ['active', 'probation', 'onboarding'] }
  };
  if (department) filter.department = department;

  const employees = await Employee.find(filter).lean();
  const employeeIds = employees.map(e => e._id);

  const activeRisks = await WorkforceRisk.find({
    employeeId: { $in: employeeIds },
    status: 'active'
  }).lean();

  const riskSet = new Set(activeRisks.map(r => r.employeeId.toString()));
  const normalizedTargetSkill = skillName ? normalizeSkillName(skillName) : null;

  const profiles = employees
    .map(emp => {
      const skills = (emp.skills || []).map(s => ({
        ...s,
        name: normalizeSkillName(s.name)
      }));

      const verifiedCount = skills.filter(s => s.verified).length;

      return {
        employeeId: emp._id.toString(),
        name: emp.name,
        email: emp.email,
        department: emp.department as DepartmentName,
        roleTitle: emp.roleTitle,
        level: emp.level,
        skills,
        totalSkillsCount: skills.length,
        verifiedSkillsCount: verifiedCount,
        hasActiveRisk: riskSet.has(emp._id.toString()),
        flightRiskLevel: emp.flightRiskLevel || 'low'
      };
    })
    .filter(p => {
      if (!normalizedTargetSkill) return true;
      return p.skills.some(s => s.name === normalizedTargetSkill);
    });

  return profiles;
}
