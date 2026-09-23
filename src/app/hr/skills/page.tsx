'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ISummary {
  totalEmployees: number;
  totalDepartments: number;
  totalUniqueSkills: number;
  totalRequirements: number;
  criticalGaps: number;
  moderateGaps: number;
  healthySkills: number;
  overallVerifiedCoverageRate: number;
  totalUpskillingCandidates: number;
}

interface IEmployeeSkillRef {
  employeeId: string;
  name: string;
  roleTitle: string;
  proficiency: string;
  level?: string;
  flightRiskLevel?: string;
}

interface IUpskillingCandidate {
  employeeId: string;
  name: string;
  roleTitle: string;
  department: string;
  adjacentSkills: string[];
  readinessScore: number;
  flightRiskLevel?: string;
}

interface IRecruitmentOpp {
  jobId: string;
  title: string;
  department: string;
  openPositions: number;
  status: string;
  matchedCandidatesCount: number;
  topCandidateScore: number;
}

interface ISkillGap {
  department: string;
  skill: string;
  category: string;
  criticality: 'high' | 'medium' | 'low';
  targetHeadcount: number;
  availableHeadcount: number;
  verifiedHeadcount: number;
  unverifiedHeadcount: number;
  minimumProficiency: string;
  gapHeadcount: number;
  verifiedGapHeadcount: number;
  coverageRatio: number;
  verifiedCoverageRatio: number;
  severity: 'critical' | 'moderate' | 'healthy';
  hasCompoundRisk: boolean;
  compoundRiskDetails?: string[];
  verifiedEmployees: IEmployeeSkillRef[];
  unverifiedEmployees: IEmployeeSkillRef[];
  upskillingCandidates: IUpskillingCandidate[];
  recruitmentOpportunities: IRecruitmentOpp[];
}

interface IMatrixSkill {
  skill: string;
  category: string;
  criticality: 'high' | 'medium' | 'low';
  targetHeadcount: number;
  verifiedHeadcount: number;
  availableHeadcount: number;
  severity: 'critical' | 'moderate' | 'healthy';
  verifiedCoverageRatio: number;
}

interface IMatrixDepartment {
  department: string;
  skills: IMatrixSkill[];
}

interface IAIExplanation {
  summary: string;
  whyItMatters: string;
  coverageAnalysis: string;
  upskillingPaths: string[];
  recruitmentOptions: string[];
  riskContext?: string;
  recommendations: string[];
  isFallback?: boolean;
}

export default function SkillIntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data state
  const [summary, setSummary] = useState<ISummary | null>(null);
  const [gaps, setGaps] = useState<ISkillGap[]>([]);
  const [matrix, setMatrix] = useState<IMatrixDepartment[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'cockpit' | 'matrix'>('cockpit');

  // AI Explanation Modal/Drawer State
  const [explainingGap, setExplainingGap] = useState<ISkillGap | null>(null);
  const [explanation, setExplanation] = useState<IAIExplanation | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Role check
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Load overview and gaps data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const deptParam = selectedDept !== 'all' ? `?department=${encodeURIComponent(selectedDept)}` : '';
      const [overviewRes, gapsRes, matrixRes] = await Promise.all([
        fetch(`/api/hr/skills${deptParam}`),
        fetch(`/api/hr/skills/gaps${deptParam}`),
        fetch(`/api/hr/skills/matrix`),
      ]);

      const [overviewJson, gapsJson, matrixJson] = await Promise.all([
        overviewRes.json(),
        gapsRes.json(),
        matrixRes.json(),
      ]);

      const ov = overviewJson.overview || overviewJson.data || overviewJson;
      const gapsList = gapsJson.skills || gapsJson.data || [];
      const matrixList = matrixJson.matrix || matrixJson.data || [];

      if (ov.summary) {
        setSummary(ov.summary);
      } else if (ov.totalSkillsTracked !== undefined) {
        setSummary({
          totalEmployees: ov.summary?.totalEmployees || 0,
          totalDepartments: ov.departmentSummaries?.length || 5,
          totalUniqueSkills: ov.totalSkillsTracked,
          totalRequirements: ov.totalSkillsTracked,
          criticalGaps: ov.totalCriticalGaps,
          moderateGaps: ov.totalModerateGaps,
          healthySkills: Math.max(0, ov.totalSkillsTracked - ov.totalCriticalGaps - ov.totalModerateGaps),
          overallVerifiedCoverageRate: (ov.totalVerifiedCoverageRate || 100) / 100,
          totalUpskillingCandidates: ov.totalUpskillingOpportunities
        });
      }

      setGaps(Array.isArray(gapsList) ? gapsList : []);
      setMatrix(Array.isArray(matrixList) ? matrixList : []);

      // Extract unique departments list
      const deptList = ov.departments || ov.departmentSummaries || [];
      if (deptList.length > 0) {
        const deptNames = deptList.map((d: any) => d.department);
        setDepartments(deptNames);
      } else {
        setDepartments(['Engineering', 'Product & Design', 'Sales & Marketing', 'Operations & HR', 'Finance']);
      }
    } catch (err: any) {
      console.error('Error loading skill intelligence:', err);
      setErrorMsg(err.message || 'Failed to load skill intelligence data');
    } finally {
      setLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    if (user && (user.role === 'recruiter' || user.role === 'admin')) {
      fetchData();
    }
  }, [user, fetchData]);

  // Trigger Gemini Explanation
  const handleExplainGap = async (gap: ISkillGap) => {
    setExplainingGap(gap);
    setExplanation(null);
    setLoadingAi(true);

    try {
      const res = await fetch('/api/hr/skills/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to explain skill gap');
      }
      setExplanation({ ...data.data, isFallback: data.isFallback });
    } catch (err: any) {
      console.error('Explain gap error:', err);
      setExplanation({
        summary: `Strategic skill analysis for ${gap.skill} in ${gap.department}.`,
        whyItMatters: `This is a ${gap.criticality} priority requirement with ${gap.verifiedHeadcount} verified headcount against a target of ${gap.targetHeadcount}.`,
        coverageAnalysis: `Current verified coverage is ${Math.round(gap.verifiedCoverageRatio * 100)}%. There are ${gap.unverifiedEmployees.length} unverified employees.`,
        upskillingPaths: gap.upskillingCandidates.map(
          (c) => `${c.name} (${c.roleTitle}) possesses adjacent skills: ${c.adjacentSkills.join(', ')} with ${c.readinessScore}% readiness.`
        ),
        recruitmentOptions: gap.recruitmentOpportunities.map(
          (r) => `${r.title} (${r.status}): ${r.matchedCandidatesCount} candidates in pipeline.`
        ),
        recommendations: [
          'Initiate technical verification assessment for self-reported staff.',
          'Offer targeted training to high-readiness adjacent staff.',
          'Accelerate active job requisitions to bridge critical gaps.',
        ],
        isFallback: true,
      });
    } finally {
      setLoadingAi(false);
    }
  };

  // Filtered gaps list
  const filteredGaps = useMemo(() => {
    return gaps.filter((g) => {
      // Severity filter
      if (severityFilter !== 'all' && g.severity !== severityFilter) {
        return false;
      }
      // Search query (skill name, department, employee name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSkill = g.skill.toLowerCase().includes(q);
        const matchDept = g.department.toLowerCase().includes(q);
        const matchEmployee =
          g.verifiedEmployees.some((e) => e.name.toLowerCase().includes(q)) ||
          g.unverifiedEmployees.some((e) => e.name.toLowerCase().includes(q)) ||
          g.upskillingCandidates.some((c) => c.name.toLowerCase().includes(q));
        if (!matchSkill && !matchDept && !matchEmployee) {
          return false;
        }
      }
      return true;
    });
  }, [gaps, severityFilter, searchQuery]);

  // Critical gaps count for callout
  const criticalGapsCount = useMemo(() => {
    return gaps.filter((g) => g.severity === 'critical').length;
  }, [gaps]);

  if (authLoading || (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-xl pb-24">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">hub</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Workforce Skill Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              Phase 2.7 Cockpit
            </span>
          </div>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Evidence-backed skill coverage, capability matrix, compound workforce risk detection, and recruitment linkage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant">
            <button
              onClick={() => setActiveView('cockpit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                activeView === 'cockpit'
                  ? 'bg-primary text-on-primary shadow-sm font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              Skill Cockpit
            </button>
            <button
              onClick={() => setActiveView('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                activeView === 'matrix'
                  ? 'bg-primary text-on-primary shadow-sm font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
              Capability Matrix
            </button>
          </div>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-2 px-md py-sm bg-surface-container-high border border-outline-variant rounded-lg font-semibold text-on-surface hover:bg-surface-container-highest transition-all disabled:opacity-50"
            title="Refresh Skill Intelligence"
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>sync</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-md rounded-lg bg-error/10 border border-error/20 text-error flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="font-body-md text-body-md font-medium">{errorMsg}</p>
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
          {/* Card 1: Unique Skills Tracked */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Skills Catalog
              </span>
              <span className="material-symbols-outlined text-primary">psychology</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                {summary.totalUniqueSkills}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                across {summary.totalDepartments} depts
              </span>
            </div>
            <div className="mt-2 text-xs text-on-surface-variant">
              {summary.totalEmployees} employees indexed
            </div>
          </div>

          {/* Card 2: Verified Coverage Rate */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Verified Coverage
              </span>
              <span className="material-symbols-outlined text-green-500">verified</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                {Math.round(summary.overallVerifiedCoverageRate * 100)}%
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                benchmarked
              </span>
            </div>
            <div className="w-full bg-surface-container-highest rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-green-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, Math.round(summary.overallVerifiedCoverageRate * 100))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Critical Gaps */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            {summary.criticalGaps > 0 && (
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full pointer-events-none" />
            )}
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Critical Skill Gaps
              </span>
              <span className="material-symbols-outlined text-red-500">dangerous</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-red-600 dark:text-red-400">
                {summary.criticalGaps}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                {summary.moderateGaps} moderate
              </span>
            </div>
            <div className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
              Immediate action needed
            </div>
          </div>

          {/* Card 4: Upskilling Candidates */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Upskilling Talent
              </span>
              <span className="material-symbols-outlined text-blue-500">trending_up</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                {summary.totalUpskillingCandidates}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                candidates
              </span>
            </div>
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              Adjacent competencies detected
            </div>
          </div>

          {/* Card 5: Healthy Competencies */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Healthy Competencies
              </span>
              <span className="material-symbols-outlined text-teal-500">check_circle</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-teal-600 dark:text-teal-400">
                {summary.healthySkills}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                / {summary.totalRequirements} tracked
              </span>
            </div>
            <div className="mt-2 text-xs text-on-surface-variant">
              Meets or exceeds target
            </div>
          </div>
        </div>
      )}

      {/* Critical Gap Alert Banner (if any) */}
      {criticalGapsCount > 0 && (
        <div className="p-md rounded-xl bg-red-500/10 border border-red-500/20 text-on-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500 text-2xl mt-0.5">report</span>
            <div>
              <h4 className="font-title-md text-title-md font-bold text-red-600 dark:text-red-400">
                {criticalGapsCount} Critical Skill {criticalGapsCount === 1 ? 'Gap' : 'Gaps'} Identified
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Key departments have verified coverage below 40% of their operational target, posing business execution risks.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSeverityFilter('critical')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Filter Critical Only
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-md p-md bg-surface-container-low border border-outline-variant rounded-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Selector */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">corporate_fare</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-surface-container border border-outline-variant text-on-surface rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">tune</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-surface-container border border-outline-variant text-on-surface rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical (&lt;40% Coverage)</option>
              <option value="moderate">Moderate (40-79% Coverage)</option>
              <option value="healthy">Healthy (80%+ Coverage)</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search skills, depts, employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant text-on-surface rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary placeholder:text-on-surface-variant/60"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4" />
          <p className="text-on-surface-variant font-medium">Aggregating workforce skill intelligence...</p>
        </div>
      ) : activeView === 'matrix' ? (
        /* ================= Capability Matrix View ================= */
        <div className="space-y-lg">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg shadow-sm">
            <div className="mb-md">
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">table_chart</span>
                Department Capability Matrix
              </h2>
              <p className="text-on-surface-variant font-body-sm text-body-sm mt-0.5">
                Target headcount vs verified employee capabilities across organizational departments.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-xs font-semibold text-on-surface-variant uppercase tracking-wider bg-surface-container/50">
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Required Skill</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Target</th>
                    <th className="py-3 px-4 text-center">Available</th>
                    <th className="py-3 px-4 text-center">Verified</th>
                    <th className="py-3 px-4 text-center">Coverage</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body-sm text-sm">
                  {matrix.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                        No capability requirements defined.
                      </td>
                    </tr>
                  ) : (
                    matrix.flatMap((dept) =>
                      dept.skills.map((s, idx) => (
                        <tr
                          key={`${dept.department}-${s.skill}`}
                          className="hover:bg-surface-container-high/50 transition-colors"
                        >
                          {idx === 0 ? (
                            <td
                              rowSpan={dept.skills.length}
                              className="py-3 px-4 font-semibold text-on-surface align-top border-r border-outline-variant bg-surface-container-low"
                            >
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-base">corporate_fare</span>
                                {dept.department}
                              </div>
                            </td>
                          ) : null}
                          <td className="py-3 px-4 font-medium text-on-surface">
                            {s.skill}
                            {s.criticality === 'high' && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400">
                                High
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant capitalize">{s.category}</td>
                          <td className="py-3 px-4 text-center font-bold text-on-surface">{s.targetHeadcount}</td>
                          <td className="py-3 px-4 text-center text-on-surface">{s.availableHeadcount}</td>
                          <td className="py-3 px-4 text-center font-bold text-green-600 dark:text-green-400">
                            {s.verifiedHeadcount}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-semibold text-xs text-on-surface">
                                {Math.round(s.verifiedCoverageRatio * 100)}%
                              </span>
                              <div className="w-16 bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    s.severity === 'critical'
                                      ? 'bg-red-500'
                                      : s.severity === 'moderate'
                                      ? 'bg-amber-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.round(s.verifiedCoverageRatio * 100))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                s.severity === 'critical'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                  : s.severity === 'moderate'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
                              }`}
                            >
                              {s.severity}
                            </span>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= Cockpit / Gap Cards View ================= */
        <div className="space-y-lg">
          {filteredGaps.length === 0 ? (
            <div className="p-xl rounded-xl bg-surface-container-low border border-outline-variant text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">check_circle</span>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                No Skill Gaps Match Current Filter
              </h3>
              <p className="text-on-surface-variant text-sm max-w-md mx-auto">
                All tracked competencies meet your selected criteria. Try adjusting the department or severity filter.
              </p>
            </div>
          ) : (
            <div className="space-y-md">
              {filteredGaps.map((gap) => (
                <div
                  key={`${gap.department}-${gap.skill}`}
                  className={`p-lg rounded-xl bg-surface-container-low border shadow-sm transition-all hover:shadow-md ${
                    gap.severity === 'critical'
                      ? 'border-red-500/30 dark:border-red-500/20'
                      : gap.severity === 'moderate'
                      ? 'border-amber-500/30 dark:border-amber-500/20'
                      : 'border-outline-variant'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md border-b border-outline-variant pb-md">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                          {gap.skill}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant capitalize">
                          {gap.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                          {gap.department}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            gap.severity === 'critical'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                              : gap.severity === 'moderate'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                          }`}
                        >
                          {gap.severity} GAP
                        </span>
                        {gap.hasCompoundRisk && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <span className="material-symbols-outlined text-xs">radar</span>
                            Compound Risk
                          </span>
                        )}
                      </div>
                      <p className="text-on-surface-variant text-xs">
                        Min. proficiency requirement: <strong className="text-on-surface capitalize">{gap.minimumProficiency}</strong>
                        {' · '}Criticality: <strong className="text-on-surface capitalize">{gap.criticality}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Visual Coverage Gauge */}
                      <div className="text-right">
                        <div className="text-xs text-on-surface-variant font-medium">Verified Coverage</div>
                        <div className="flex items-baseline gap-1.5 justify-end">
                          <span className="text-xl font-black text-on-surface">
                            {gap.verifiedHeadcount}
                          </span>
                          <span className="text-xs text-on-surface-variant">/ {gap.targetHeadcount} target</span>
                          <span
                            className={`text-xs font-bold ml-1 ${
                              gap.severity === 'critical'
                                ? 'text-red-500'
                                : gap.severity === 'moderate'
                                ? 'text-amber-500'
                                : 'text-green-500'
                            }`}
                          >
                            ({Math.round(gap.verifiedCoverageRatio * 100)}%)
                          </span>
                        </div>
                      </div>

                      {/* AI Explain Action */}
                      <button
                        onClick={() => handleExplainGap(gap)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-sm">psychology</span>
                        Explain Gap
                      </button>
                    </div>
                  </div>

                  {/* Compound Risk Alert Banner (if single point of failure at risk) */}
                  {gap.hasCompoundRisk && gap.compoundRiskDetails && gap.compoundRiskDetails.length > 0 && (
                    <div className="mt-md p-sm rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-on-surface flex items-start gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
                      <div>
                        <strong className="text-amber-700 dark:text-amber-400 font-semibold">Retention & Single Point of Failure Threat:</strong>
                        <ul className="list-disc list-inside mt-0.5 text-on-surface-variant space-y-0.5">
                          {gap.compoundRiskDetails.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Detailed Multi-Signal Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-md">
                    {/* Column 1: Existing Coverage */}
                    <div className="bg-surface-container/50 rounded-lg p-md border border-outline-variant space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-green-500 text-sm">verified</span>
                          Current Team Coverage
                        </span>
                        <span className="text-[11px] font-semibold text-on-surface-variant">
                          {gap.verifiedHeadcount} verified · {gap.unverifiedHeadcount} unverified
                        </span>
                      </div>

                      {gap.verifiedEmployees.length === 0 && gap.unverifiedEmployees.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic py-2">
                          No employees in {gap.department} have logged this skill.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {gap.verifiedEmployees.map((emp) => (
                            <div
                              key={emp.employeeId}
                              className="flex items-center justify-between p-1.5 rounded bg-surface-container-high/60 text-xs"
                            >
                              <div className="truncate">
                                <span className="font-medium text-on-surface">{emp.name}</span>
                                <span className="text-[11px] text-on-surface-variant block truncate">
                                  {emp.roleTitle} {emp.level ? `(${emp.level})` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px]">check</span>
                                  {emp.proficiency}
                                </span>
                                {emp.flightRiskLevel && emp.flightRiskLevel !== 'low' && (
                                  <span
                                    title={`Flight risk: ${emp.flightRiskLevel}`}
                                    className="px-1 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-500"
                                  >
                                    Risk: {emp.flightRiskLevel}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {gap.unverifiedEmployees.map((emp) => (
                            <div
                              key={emp.employeeId}
                              className="flex items-center justify-between p-1.5 rounded bg-surface-container/60 text-xs border border-dashed border-outline-variant"
                            >
                              <div className="truncate">
                                <span className="font-medium text-on-surface">{emp.name}</span>
                                <span className="text-[11px] text-on-surface-variant block truncate">
                                  {emp.roleTitle}
                                </span>
                              </div>
                              <span
                                title="Self-reported but not verified by technical assessment"
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              >
                                Self-Reported ({emp.proficiency})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Upskilling Candidates (Adjacent Capabilities) */}
                    <div className="bg-surface-container/50 rounded-lg p-md border border-outline-variant space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-blue-500 text-sm">trending_up</span>
                          Upskilling Opportunities
                        </span>
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          {gap.upskillingCandidates.length} eligible
                        </span>
                      </div>

                      {gap.upskillingCandidates.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic py-2">
                          No adjacent skill matches identified in existing workforce graph.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {gap.upskillingCandidates.map((c) => (
                            <div
                              key={c.employeeId}
                              className="p-1.5 rounded bg-surface-container-high/60 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-on-surface truncate">{c.name}</span>
                                <span className="font-bold text-[11px] text-blue-600 dark:text-blue-400">
                                  {c.readinessScore}% Readiness
                                </span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant truncate">{c.roleTitle}</p>
                              <div className="flex flex-wrap gap-1">
                                {c.adjacentSkills.map((adj) => (
                                  <span
                                    key={adj}
                                    className="px-1 py-0.2 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300"
                                  >
                                    {adj}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 3: Recruitment Pipeline Linkage */}
                    <div className="bg-surface-container/50 rounded-lg p-md border border-outline-variant space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-purple-500 text-sm">person_search</span>
                          Recruitment Pipeline
                        </span>
                        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                          {gap.recruitmentOpportunities.length} jobs
                        </span>
                      </div>

                      {gap.recruitmentOpportunities.length === 0 ? (
                        <div className="py-2 text-xs text-on-surface-variant space-y-2">
                          <p className="italic">No active job requisition currently targeting this requirement.</p>
                          <Link
                            href="/recruiter/create-job"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <span className="material-symbols-outlined text-xs">add</span>
                            Open a Requisition
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {gap.recruitmentOpportunities.map((opp) => (
                            <div
                              key={opp.jobId}
                              className="p-2 rounded bg-surface-container-high/60 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <Link
                                  href={`/hr/recruitment?jobId=${opp.jobId}`}
                                  className="font-medium text-primary hover:underline truncate"
                                >
                                  {opp.title}
                                </Link>
                                <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                                  {opp.openPositions} {opp.openPositions === 1 ? 'seat' : 'seats'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                                <span>{opp.matchedCandidatesCount} candidates ranked</span>
                                {opp.topCandidateScore > 0 && (
                                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                                    Top match: {opp.topCandidateScore}%
                                  </span>
                                )}
                              </div>
                              <Link
                                href={`/hr/recruitment?jobId=${opp.jobId}`}
                                className="block text-center py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold text-[10px] hover:bg-purple-500/20 transition-colors"
                              >
                                View Candidates in Cockpit →
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Grounded Explanation Modal / Drawer */}
      {explainingGap && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-lg border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-low/95 backdrop-blur z-10">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-2xl">psychology</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Skill Gap Intelligence Briefing
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {explainingGap.department} · {explainingGap.skill} ({explainingGap.category})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setExplainingGap(null);
                  setExplanation(null);
                }}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-lg space-y-lg flex-1">
              {loadingAi ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
                  <p className="text-sm font-medium text-on-surface-variant">
                    Generating evidence-grounded strategic briefing...
                  </p>
                </div>
              ) : explanation ? (
                <div className="space-y-md">
                  {/* Grounding Badge */}
                  <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-surface-container border border-outline-variant">
                    <span className="flex items-center gap-1.5 text-on-surface font-medium">
                      <span className="material-symbols-outlined text-green-500 text-sm">shield</span>
                      Evidence Grounded: Telemetry, active headcount, and recruitment pipeline
                    </span>
                    {explanation.isFallback && (
                      <span className="text-[10px] uppercase font-bold text-amber-500">Deterministic Rule Engine</span>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="p-md rounded-xl bg-surface-container border border-outline-variant">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-primary tracking-wider mb-1">
                      Strategic Assessment
                    </h4>
                    <p className="font-body-md text-sm text-on-surface leading-relaxed">
                      {explanation.summary}
                    </p>
                  </div>

                  {/* Why it Matters */}
                  <div className="p-md rounded-xl bg-surface-container border border-outline-variant">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-on-surface-variant tracking-wider mb-1">
                      Business Impact & Risk
                    </h4>
                    <p className="font-body-md text-sm text-on-surface leading-relaxed">
                      {explanation.whyItMatters}
                    </p>
                    {explanation.riskContext && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/50 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {explanation.riskContext}
                      </div>
                    )}
                  </div>

                  {/* Coverage Breakdown */}
                  <div className="p-md rounded-xl bg-surface-container border border-outline-variant">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-on-surface-variant tracking-wider mb-1">
                      Headcount & Coverage Telemetry
                    </h4>
                    <p className="font-body-md text-sm text-on-surface leading-relaxed">
                      {explanation.coverageAnalysis}
                    </p>
                  </div>

                  {/* Recommendations */}
                  <div className="p-md rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-primary tracking-wider">
                      Recommended Strategic Next Steps
                    </h4>
                    <ul className="space-y-1.5 text-sm text-on-surface">
                      {explanation.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-primary text-base mt-0.5">arrow_right</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Upskilling Paths & Recruitment Links */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-md pt-2">
                    {explanation.upskillingPaths.length > 0 && (
                      <div className="p-sm rounded-lg bg-surface-container text-xs space-y-1">
                        <strong className="text-blue-500 font-semibold block">Upskilling Trajectories:</strong>
                        <ul className="list-disc list-inside text-on-surface-variant space-y-0.5">
                          {explanation.upskillingPaths.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {explanation.recruitmentOptions.length > 0 && (
                      <div className="p-sm rounded-lg bg-surface-container text-xs space-y-1">
                        <strong className="text-purple-500 font-semibold block">Recruitment Support:</strong>
                        <ul className="list-disc list-inside text-on-surface-variant space-y-0.5">
                          {explanation.recruitmentOptions.map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-md border-t border-outline-variant flex justify-end bg-surface-container-low/95">
              <button
                onClick={() => {
                  setExplainingGap(null);
                  setExplanation(null);
                }}
                className="px-4 py-2 bg-surface-container-high text-on-surface font-semibold rounded-lg text-sm hover:bg-surface-container-highest transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
