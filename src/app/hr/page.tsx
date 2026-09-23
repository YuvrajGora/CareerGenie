'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PriorityInsight {
  id: string;
  category: 'compound_risk' | 'skill_gap' | 'workforce_risk' | 'recruitment' | 'onboarding' | 'policy' | string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  summary: string;
  evidence: string[];
  affectedEntity: string;
  recommendedAction: string;
  sourceModule: 'skills' | 'risks' | 'recruitment' | 'onboarding' | 'interviews' | 'policies';
  relatedRoute: string;
}

interface HRCommandCenterData {
  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    onboardingEmployees: number;
    probationEmployees: number;
    noticePeriodEmployees: number;
    departmentBreakdown: Record<string, number>;
  };
  risks: {
    totalWorkforceRisks: number;
    highCriticalRisks: number;
    affectedEmployeesCount: number;
    affectedDepartments: string[];
    criticalRiskCategories: Record<string, number>;
    topActionableRisks: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      employeeCode?: string;
      department: string;
      roleTitle: string;
      riskType: string;
      severity: string;
      score: number;
      whatHappened?: string;
      whyItMatters?: string;
      recommendedAction?: string;
    }>;
  };
  skills: {
    totalTrackedSkills: number;
    criticalSkillGapsCount: number;
    moderateSkillGapsCount: number;
    healthySkillsCount: number;
    overallVerifiedCoverageRate: number;
    departmentsWithSkillGaps: string[];
    lowestCoverageSkills: Array<{
      skill: string;
      department: string;
      targetHeadcount: number;
      verifiedHeadcount: number;
      coverageRatio: number;
      severity: string;
      hasCompoundRisk: boolean;
    }>;
    compoundSkillRetentionRisksCount: number;
  };
  recruitment: {
    activeJobsCount: number;
    candidateCount: number;
    strongMatchesCount: number;
    interviewingCandidatesCount: number;
    averageMatchScore: number;
    topRecruitmentOpportunities: Array<{
      jobId: string;
      title: string;
      department: string;
      openPositions: number;
      matchingCandidatesCount: number;
      topCandidateScore: number;
    }>;
  };
  interviews: {
    pipelineEvaluationsCount: number;
    averageInterviewScore: number;
    recommendationsBreakdown: {
      strong_hire: number;
      hire: number;
      borderline: number;
      do_not_hire: number;
    };
    recentEvaluations: Array<{
      id: string;
      candidateName: string;
      jobTitle: string;
      interviewStage: string;
      score: number;
      recommendation: string;
      evaluatedAt: string;
    }>;
  };
  onboarding: {
    activePlansCount: number;
    onTrackCount: number;
    delayedCount: number;
    completedCount: number;
    averageProgress: number;
    employeesNeedingAttention: Array<{
      planId: string;
      employeeId: string;
      employeeName: string;
      department: string;
      roleTitle: string;
      progress: number;
      velocityScore: number;
      status: string;
      overdueMilestonesCount: number;
    }>;
  };
  policies: {
    availablePolicyCount: number;
    policyIntelligenceStatus: 'operational' | 'degraded';
    recentPolicyTopics: string[];
  };
  priorityInsights: PriorityInsight[];
}

interface CommandCenterBriefing {
  executiveSummary: string;
  topRiskAnalysis: string;
  strategicRecommendations: string[];
  operationalPosture: 'critical_attention' | 'action_required' | 'balanced' | 'optimal';
  groundedFacts: {
    totalEmployees: number;
    highCriticalRisks: number;
    criticalSkillGaps: number;
    activeJobs: number;
    delayedOnboarding: number;
  };
}

export default function HRCommandCenterPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<HRCommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter for priority insights
  const [insightFilter, setInsightFilter] = useState<string>('all');

  // AI Strategic Briefing Modal
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [briefing, setBriefing] = useState<CommandCenterBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Access check
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch command center data
  const fetchCommandCenterData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch('/api/hr/command-center');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to load HR Command Center intelligence');
      }

      setData(json.data);
    } catch (err: any) {
      console.error('Command Center load error:', err);
      setErrorMsg(err.message || 'Error connecting to Command Center service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'recruiter' || user.role === 'admin')) {
      fetchCommandCenterData();
    }
  }, [user, fetchCommandCenterData]);

  // Fetch AI Briefing
  const handleOpenBriefing = async () => {
    setBriefingModalOpen(true);
    if (briefing) return; // already loaded

    try {
      setBriefingLoading(true);
      const res = await fetch('/api/hr/command-center?briefing=true');
      const json = await res.json();
      if (json.success && json.briefing) {
        setBriefing(json.briefing);
      } else {
        // Fallback briefing from local data
        setBriefing({
          executiveSummary: `Workforce Command Center overview indicates ${data?.workforce.totalEmployees || 0} employees indexed with ${data?.risks.highCriticalRisks || 0} active critical risk(s) and ${data?.skills.criticalSkillGapsCount || 0} critical skill gap(s).`,
          topRiskAnalysis: `Primary cross-module focus required for identified single-point-of-failure skills and delayed onboarding personnel.`,
          strategicRecommendations: [
            'Address retention signals for key engineers holding critical domain capabilities.',
            'Expedite candidate interview loops for open requisitions.',
            'Review delayed onboarding plans and assign peer mentors.'
          ],
          operationalPosture: (data?.risks.highCriticalRisks || 0) > 0 ? 'critical_attention' : 'balanced',
          groundedFacts: {
            totalEmployees: data?.workforce.totalEmployees || 0,
            highCriticalRisks: data?.risks.highCriticalRisks || 0,
            criticalSkillGaps: data?.skills.criticalSkillGapsCount || 0,
            activeJobs: data?.recruitment.activeJobsCount || 0,
            delayedOnboarding: data?.onboarding.delayedCount || 0
          }
        });
      }
    } catch (err) {
      console.error('Briefing error:', err);
    } finally {
      setBriefingLoading(false);
    }
  };

  // Filtered insights
  const filteredInsights = useMemo(() => {
    if (!data?.priorityInsights) return [];
    if (insightFilter === 'all') return data.priorityInsights;
    if (insightFilter === 'critical') return data.priorityInsights.filter(i => i.severity === 'critical');
    if (insightFilter === 'high') return data.priorityInsights.filter(i => i.severity === 'high');
    if (insightFilter === 'compound') return data.priorityInsights.filter(i => i.category === 'compound_risk');
    if (insightFilter === 'recruitment') return data.priorityInsights.filter(i => i.sourceModule === 'recruitment');
    return data.priorityInsights;
  }, [data, insightFilter]);

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
            <span className="material-symbols-outlined text-primary text-3xl">space_dashboard</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              HR Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              Unified Platform
            </span>
          </div>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Workforce intelligence, risks, skills, recruitment and people operations in one view.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenBriefing}
            className="flex items-center gap-2 px-md py-sm bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">psychology</span>
            <span>AI Executive Briefing</span>
          </button>

          <button
            onClick={() => fetchCommandCenterData()}
            disabled={loading}
            className="flex items-center gap-2 px-md py-sm bg-surface-container-high border border-outline-variant rounded-lg font-semibold text-on-surface hover:bg-surface-container-highest transition-all disabled:opacity-50 text-xs"
            title="Refresh Command Center"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          <p className="text-on-surface-variant font-medium">Synthesizing workforce command intelligence...</p>
        </div>
      ) : data ? (
        <>
          {/* ============================================================= */}
          {/* 1. TOP EXECUTIVE KPI CARDS                                     */}
          {/* ============================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
            {/* Card 1: Active Workforce */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-sm">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Workforce Headcount
                </span>
                <span className="material-symbols-outlined text-primary">groups</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                  {data.workforce.totalEmployees}
                </span>
                <span className="text-on-surface-variant font-body-sm text-xs">
                  ({data.workforce.activeEmployees} active)
                </span>
              </div>
              <div className="mt-2 text-xs text-on-surface-variant flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span>{data.workforce.onboardingEmployees} onboarding · {data.workforce.probationEmployees} probation</span>
              </div>
            </div>

            {/* Card 2: Critical Workforce Risks */}
            <Link
              href="/hr/risks"
              className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              {data.risks.highCriticalRisks > 0 && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full pointer-events-none" />
              )}
              <div className="flex items-center justify-between mb-sm">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Critical Risks
                </span>
                <span className="material-symbols-outlined text-red-500 group-hover:scale-110 transition-transform">radar</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-black text-red-600 dark:text-red-400">
                  {data.risks.highCriticalRisks}
                </span>
                <span className="text-on-surface-variant font-body-sm text-xs">
                  / {data.risks.totalWorkforceRisks} total
                </span>
              </div>
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                <span>{data.risks.affectedEmployeesCount} employees flagged</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </div>
            </Link>

            {/* Card 3: Critical Skill Gaps */}
            <Link
              href="/hr/skills"
              className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-sm">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Critical Skill Gaps
                </span>
                <span className="material-symbols-outlined text-amber-500 group-hover:scale-110 transition-transform">hub</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-black text-amber-600 dark:text-amber-400">
                  {data.skills.criticalSkillGapsCount}
                </span>
                <span className="text-on-surface-variant font-body-sm text-xs">
                  ({data.skills.overallVerifiedCoverageRate}% verified)
                </span>
              </div>
              <div className="mt-2 text-xs text-on-surface-variant flex items-center justify-between">
                <span>across {data.skills.departmentsWithSkillGaps.length} depts</span>
                <span className="text-primary text-xs font-semibold flex items-center">
                  Matrix <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </span>
              </div>
            </Link>

            {/* Card 4: Active Recruitment */}
            <Link
              href="/hr/recruitment"
              className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-sm">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Active Requisitions
                </span>
                <span className="material-symbols-outlined text-purple-500 group-hover:scale-110 transition-transform">person_search</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                  {data.recruitment.activeJobsCount}
                </span>
                <span className="text-on-surface-variant font-body-sm text-xs">
                  ({data.recruitment.strongMatchesCount} strong matches)
                </span>
              </div>
              <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-semibold flex items-center justify-between">
                <span>Avg match: {data.recruitment.averageMatchScore}%</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </div>
            </Link>

            {/* Card 5: Onboarding Attention */}
            <Link
              href="/hr/onboarding"
              className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-sm">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Onboarding Attention
                </span>
                <span className="material-symbols-outlined text-blue-500 group-hover:scale-110 transition-transform">assignment_ind</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`font-headline-lg text-headline-lg font-black ${
                  data.onboarding.delayedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface'
                }`}>
                  {data.onboarding.delayedCount}
                </span>
                <span className="text-on-surface-variant font-body-sm text-xs">
                  delayed / {data.onboarding.activePlansCount} active
                </span>
              </div>
              <div className="mt-2 text-xs text-on-surface-variant flex items-center justify-between">
                <span>Avg progress: {data.onboarding.averageProgress}%</span>
                <span className="text-primary text-xs font-semibold flex items-center">
                  Review <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </span>
              </div>
            </Link>
          </div>

          {/* ============================================================= */}
          {/* 2. CROSS-MODULE PRIORITY INSIGHTS                             */}
          {/* ============================================================= */}
          <div className="space-y-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">notifications_active</span>
                  Cross-Module Priority Insights
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Deterministic correlations connecting risks, skill exposures, onboarding roadblocks, and recruitment opportunities.
                </p>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 bg-surface-container p-1 rounded-lg border border-outline-variant text-xs">
                {['all', 'critical', 'high', 'compound', 'recruitment'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setInsightFilter(filter)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                      insightFilter === filter
                        ? 'bg-primary text-on-primary font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {filter === 'compound' ? 'Compound Risks' : filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredInsights.length === 0 ? (
              <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-green-500">check_circle</span>
                <h4 className="font-title-md text-title-md font-bold text-on-surface">No High-Priority Bottlenecks</h4>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                  No critical or high-severity insights match the active filter. Operations are balanced across all workforce telemetry.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {filteredInsights.map(insight => (
                  <div
                    key={insight.id}
                    className={`p-md rounded-xl bg-surface-container-low border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      insight.severity === 'critical'
                        ? 'border-red-500/40 bg-red-500/[0.02]'
                        : insight.severity === 'high'
                        ? 'border-amber-500/40 bg-amber-500/[0.02]'
                        : 'border-outline-variant'
                    }`}
                  >
                    <div className="space-y-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              insight.severity === 'critical'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                : insight.severity === 'high'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                          >
                            {insight.severity}
                          </span>
                          <span className="text-[11px] font-semibold text-on-surface-variant capitalize">
                            {insight.category.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant/70 uppercase font-mono">
                          {insight.sourceModule}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-title-sm text-sm font-bold text-on-surface">
                          {insight.title}
                        </h4>
                        <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-relaxed">
                          {insight.summary}
                        </p>
                      </div>

                      {/* Evidence List */}
                      {insight.evidence.length > 0 && (
                        <div className="bg-surface-container/60 p-2 rounded-lg text-xs space-y-1 border border-outline-variant/50">
                          <strong className="text-[11px] text-on-surface-variant font-semibold block">Underlying Evidence:</strong>
                          <ul className="space-y-0.5">
                            {insight.evidence.map((ev, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-on-surface-variant text-[11px]">
                                <span className="material-symbols-outlined text-primary text-xs mt-0.5">check_circle</span>
                                <span>{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommended Action */}
                      <div className="text-xs p-2 rounded-lg bg-primary/5 border border-primary/15 text-on-surface">
                        <strong className="text-primary text-[11px] font-bold block mb-0.5">Recommended Action:</strong>
                        <p className="text-[11px] text-on-surface leading-normal">{insight.recommendedAction}</p>
                      </div>
                    </div>

                    <div className="mt-md pt-sm border-t border-outline-variant/60 flex items-center justify-between">
                      <span className="text-[11px] text-on-surface-variant truncate">
                        Target: <strong className="text-on-surface">{insight.affectedEntity}</strong>
                      </span>
                      <Link
                        href={insight.relatedRoute}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <span>View Details</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* 3. WORKFORCE HEALTH & RISK DISTRIBUTION                       */}
          {/* ============================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            {/* Workforce Distribution */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">pie_chart</span>
                    Headcount by Department
                  </h3>
                  <p className="text-xs text-on-surface-variant">Active headcount distributed across departments.</p>
                </div>
                <span className="text-xs font-bold text-primary">{data.workforce.totalEmployees} Total</span>
              </div>

              <div className="space-y-2">
                {Object.entries(data.workforce.departmentBreakdown).map(([dept, count]) => {
                  const pct = Math.round((count / Math.max(1, data.workforce.totalEmployees)) * 100);
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-on-surface">{dept}</span>
                        <span className="text-on-surface-variant">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Risk Telemetry Breakdown */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 text-base">radar</span>
                    Severe Workforce Risks
                  </h3>
                  <p className="text-xs text-on-surface-variant">Critical & high severity risk signals detected.</p>
                </div>
                <Link href="/hr/risks" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  Radar <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(data.risks.criticalRiskCategories).map(([cat, count]) => (
                  <div key={cat} className="p-2.5 rounded-lg bg-surface-container/60 border border-outline-variant text-center">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold block truncate">
                      {cat.replace('_', ' ')}
                    </span>
                    <span className="text-lg font-black text-on-surface block mt-0.5">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {data.risks.topActionableRisks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Top Priority Retention Watch:
                  </span>
                  {data.risks.topActionableRisks.slice(0, 3).map(r => (
                    <div key={r.id} className="p-2 rounded bg-surface-container text-xs flex items-center justify-between">
                      <div className="truncate">
                        <span className="font-bold text-on-surface">{r.employeeName}</span>
                        <span className="text-on-surface-variant text-[11px] ml-1.5">({r.department} · {r.roleTitle})</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-500 shrink-0">
                        {r.riskType} (Score: {r.score})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ============================================================= */}
          {/* 4. SKILL EXPOSURE & RECRUITMENT PIPELINE                     */}
          {/* ============================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            {/* Skills Overview */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-base">hub</span>
                    Skill Gap & Capability Deficits
                  </h3>
                  <p className="text-xs text-on-surface-variant">Tracked competencies with lowest verified coverage.</p>
                </div>
                <Link href="/hr/skills" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  Skill Cockpit <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>

              <div className="space-y-2">
                {data.skills.lowestCoverageSkills.map(s => (
                  <div key={`${s.department}-${s.skill}`} className="p-2 rounded-lg bg-surface-container text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-on-surface">{s.skill}</span>
                        <span className="text-on-surface-variant text-[11px]">({s.department})</span>
                        {s.hasCompoundRisk && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Compound Risk
                          </span>
                        )}
                      </div>
                      <span className={`font-bold ${s.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                        {s.verifiedHeadcount}/{s.targetHeadcount} ({Math.round(s.coverageRatio * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-highest rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-1 rounded-full ${s.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, Math.round(s.coverageRatio * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recruitment Pipeline Overview */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 text-base">person_search</span>
                    Active Recruitment Opportunities
                  </h3>
                  <p className="text-xs text-on-surface-variant">Top requisitions addressing organizational talent requirements.</p>
                </div>
                <Link href="/hr/recruitment" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  RedRankAI <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>

              <div className="space-y-2">
                {data.recruitment.topRecruitmentOpportunities.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic py-4 text-center">
                    No active job requisitions currently open.
                  </p>
                ) : (
                  data.recruitment.topRecruitmentOpportunities.map(opp => (
                    <div key={opp.jobId} className="p-2.5 rounded-lg bg-surface-container text-xs flex items-center justify-between">
                      <div className="truncate">
                        <Link
                          href={`/hr/recruitment?jobId=${opp.jobId}`}
                          className="font-bold text-primary hover:underline block truncate"
                        >
                          {opp.title}
                        </Link>
                        <span className="text-[11px] text-on-surface-variant">
                          {opp.department} · {opp.openPositions} {opp.openPositions === 1 ? 'seat' : 'seats'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-on-surface block text-[11px]">
                          {opp.matchingCandidatesCount} matched
                        </span>
                        {opp.topCandidateScore > 0 && (
                          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                            Top match: {opp.topCandidateScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ============================================================= */}
          {/* 5. ONBOARDING & INTERVIEWS & POLICIES                         */}
          {/* ============================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            {/* Onboarding Health */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-500 text-base">assignment_ind</span>
                  Onboarding Health
                </h4>
                <Link href="/hr/onboarding" className="text-xs font-semibold text-primary hover:underline">
                  View →
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-2 rounded bg-surface-container text-xs">
                  <span className="text-[10px] text-on-surface-variant block font-semibold">Active</span>
                  <span className="font-bold text-on-surface">{data.onboarding.activePlansCount}</span>
                </div>
                <div className="p-2 rounded bg-surface-container text-xs">
                  <span className="text-[10px] text-green-600 block font-semibold">On-Track</span>
                  <span className="font-bold text-green-600">{data.onboarding.onTrackCount}</span>
                </div>
                <div className="p-2 rounded bg-surface-container text-xs">
                  <span className="text-[10px] text-amber-600 block font-semibold">Delayed</span>
                  <span className="font-bold text-amber-600">{data.onboarding.delayedCount}</span>
                </div>
              </div>

              {data.onboarding.employeesNeedingAttention.length > 0 && (
                <div className="space-y-1 pt-1 text-xs">
                  <strong className="text-[11px] text-amber-600 font-semibold block">Attention Required:</strong>
                  {data.onboarding.employeesNeedingAttention.slice(0, 2).map(e => (
                    <div key={e.planId} className="p-1.5 rounded bg-surface-container text-[11px] flex justify-between items-center">
                      <span className="truncate">{e.employeeName}</span>
                      <span className="text-amber-500 font-bold shrink-0">{e.progress}% (Vel: {e.velocityScore})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interview Intelligence */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-purple-500 text-base">psychology_alt</span>
                  Interview Intelligence
                </h4>
                <Link href="/hr/interviews" className="text-xs font-semibold text-primary hover:underline">
                  View →
                </Link>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Evaluations logged:</span>
                <span className="font-bold text-on-surface">{data.interviews.pipelineEvaluationsCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Average rubric score:</span>
                <span className="font-bold text-on-surface">{data.interviews.averageInterviewScore}/100</span>
              </div>

              <div className="pt-2 border-t border-outline-variant/60">
                <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                  <div className="p-1 rounded bg-green-500/10 text-green-700 dark:text-green-300">
                    <span className="block font-bold">{data.interviews.recommendationsBreakdown.strong_hire}</span>
                    <span>Strong</span>
                  </div>
                  <div className="p-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    <span className="block font-bold">{data.interviews.recommendationsBreakdown.hire}</span>
                    <span>Hire</span>
                  </div>
                  <div className="p-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <span className="block font-bold">{data.interviews.recommendationsBreakdown.borderline}</span>
                    <span>Border</span>
                  </div>
                  <div className="p-1 rounded bg-red-500/10 text-red-700 dark:text-red-300">
                    <span className="block font-bold">{data.interviews.recommendationsBreakdown.do_not_hire}</span>
                    <span>No Hire</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Policy Intelligence */}
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-teal-500 text-base">policy</span>
                  Policy Intelligence
                </h4>
                <Link href="/hr/policies" className="text-xs font-semibold text-primary hover:underline">
                  View →
                </Link>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Active policy handbook:</span>
                <span className="font-bold text-on-surface">{data.policies.availablePolicyCount} docs</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Intelligence status:</span>
                <span className="font-semibold text-green-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  {data.policies.policyIntelligenceStatus}
                </span>
              </div>

              <div className="pt-2 border-t border-outline-variant/60 space-y-1">
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Recent Topics:</span>
                <div className="flex flex-wrap gap-1">
                  {data.policies.recentPolicyTopics.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-container text-on-surface-variant">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ============================================================= */}
      {/* 6. AI STRATEGIC EXECUTIVE BRIEFING MODAL                      */}
      {/* ============================================================= */}
      {briefingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-lg border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-low/95 backdrop-blur z-10">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-2xl">psychology</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Executive Strategic Briefing
                  </h3>
                  <p className="text-xs text-on-surface-variant">Grounded synthesis of workforce command metrics</p>
                </div>
              </div>
              <button
                onClick={() => setBriefingModalOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-lg space-y-md flex-1">
              {briefingLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
                  <p className="text-sm font-medium text-on-surface-variant">Generating executive strategic synthesis...</p>
                </div>
              ) : briefing ? (
                <div className="space-y-md">
                  {/* Posture Badge */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant text-xs">
                    <span className="text-on-surface-variant font-medium">Operational Posture:</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      briefing.operationalPosture === 'critical_attention'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                        : briefing.operationalPosture === 'action_required'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                    }`}>
                      {briefing.operationalPosture.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Executive Summary */}
                  <div className="p-md rounded-xl bg-surface-container border border-outline-variant">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-primary tracking-wider mb-1">
                      Executive Overview
                    </h4>
                    <p className="font-body-md text-sm text-on-surface leading-relaxed">
                      {briefing.executiveSummary}
                    </p>
                  </div>

                  {/* Top Risk Exposure */}
                  <div className="p-md rounded-xl bg-surface-container border border-outline-variant">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider mb-1">
                      Primary Exposure Analysis
                    </h4>
                    <p className="font-body-md text-sm text-on-surface leading-relaxed">
                      {briefing.topRiskAnalysis}
                    </p>
                  </div>

                  {/* Strategic Recommendations */}
                  <div className="p-md rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <h4 className="font-title-sm text-xs uppercase font-bold text-primary tracking-wider">
                      Strategic Next Steps
                    </h4>
                    <ul className="space-y-1.5 text-sm text-on-surface">
                      {briefing.strategicRecommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-primary text-base mt-0.5">arrow_right</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-[11px] text-on-surface-variant/70 italic text-center">
                    Grounded strictly in verified employee telemetry, active risk radar records, and recruitment pipeline.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="p-md border-t border-outline-variant flex justify-end bg-surface-container-low/95">
              <button
                onClick={() => setBriefingModalOpen(false)}
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
