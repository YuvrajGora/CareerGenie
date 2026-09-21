'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface IRiskEvidence {
  signalType: string;
  metric: string;
  observedValue: string;
  benchmark: string;
  significance: 'high' | 'medium' | 'low';
}

interface IRiskAction {
  actionId: string;
  title: string;
  rationale: string;
  urgency: 'immediate' | 'short_term' | 'strategic';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
}

interface WorkforceRiskItem {
  _id: string;
  riskType: 'attrition' | 'burnout' | 'disengagement' | 'skill_stagnation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  aiExplanation: string;
  whatHappened?: string;
  whyItMatters?: string;
  evidence: IRiskEvidence[];
  recommendedActions: IRiskAction[];
  status: 'active' | 'mitigated' | 'resolved';
  evaluatedAt: string;
  employeeId?: {
    _id: string;
    name: string;
    email: string;
    employeeCode: string;
    department: string;
    roleTitle: string;
    level: string;
    performanceRating: number;
    flightRiskLevel: string;
    location: string;
    skills?: Array<{ name: string; proficiency: string; category: string; verified: boolean }>;
  };
}

interface RiskSummary {
  totalEvaluatedEmployees: number;
  totalActiveRisks: number;
  employeesAtRisk: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  departmentBreakdown: Record<string, number>;
  riskTypeBreakdown: Record<string, number>;
}

export default function RiskRadarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [risks, setRisks] = useState<WorkforceRiskItem[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [riskTypeFilter, setRiskTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Risk for Evidence & Action Drawer
  const [selectedRisk, setSelectedRisk] = useState<WorkforceRiskItem | null>(null);

  // Role Protection
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch risks
  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (riskTypeFilter !== 'all') params.append('riskType', riskTypeFilter);

      const res = await fetch(`/api/hr/risks?${params.toString()}`, {
        headers: {
          'X-CareerGenie-Role': user?.role || 'recruiter'
        }
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: Recruiter or Administrator credentials required.');
        }
        throw new Error('Failed to retrieve workforce risk telemetry.');
      }

      const data = await res.json();
      setRisks(data.risks || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error connecting to workforce intelligence service.');
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, severityFilter, riskTypeFilter, user?.role]);

  useEffect(() => {
    if (user && (user.role === 'recruiter' || user.role === 'admin')) {
      fetchRisks();
    }
  }, [user, fetchRisks]);

  // Run Deterministic Evaluation
  const handleRunEvaluation = async () => {
    setEvaluating(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await fetch('/api/hr/risks/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        throw new Error('Failed to execute deterministic workforce evaluation.');
      }

      const result = await res.json();
      setActionSuccessMsg(
        `Evaluation complete: Evaluated ${result.evaluatedEmployees} employees, identified ${result.risksDetected} active risk profiles (${result.critical} Critical, ${result.high} High).`
      );
      await fetchRisks();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Evaluation run failed.');
    } finally {
      setEvaluating(false);
    }
  };

  // Filtered risks based on local search
  const filteredRisks = risks.filter((risk) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const empName = risk.employeeId?.name?.toLowerCase() || '';
    const empCode = risk.employeeId?.employeeCode?.toLowerCase() || '';
    const empRole = risk.employeeId?.roleTitle?.toLowerCase() || '';
    const dept = risk.employeeId?.department?.toLowerCase() || '';
    return empName.includes(q) || empCode.includes(q) || empRole.includes(q) || dept.includes(q);
  });

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/15 text-red-500 border border-red-500/30';
      case 'high':
        return 'bg-amber-500/15 text-amber-500 border border-amber-500/30';
      case 'medium':
        return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
      default:
        return 'bg-blue-500/15 text-blue-500 border border-blue-500/30';
    }
  };

  const getRiskTypeBadge = (riskType: string) => {
    switch (riskType) {
      case 'burnout':
        return { label: 'Burnout Risk', icon: 'local_fire_department', color: 'text-rose-500' };
      case 'attrition':
        return { label: 'Flight / Attrition Risk', icon: 'flight_takeoff', color: 'text-orange-500' };
      case 'disengagement':
        return { label: 'Disengagement', icon: 'sentiment_dissatisfied', color: 'text-amber-500' };
      case 'skill_stagnation':
        return { label: 'Skill Stagnation', icon: 'psychology_alt', color: 'text-purple-500' };
      default:
        return { label: riskType, icon: 'warning', color: 'text-gray-500' };
    }
  };

  if (authLoading || (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-xl pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">radar</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Risk & Retention Radar
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              HR Decision Intelligence
            </span>
          </div>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Deterministic cross-signal correlation of workload, engagement, performance, and skill stagnation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunEvaluation}
            disabled={evaluating}
            className="flex items-center gap-2 px-md py-sm bg-primary text-on-primary rounded-lg font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${evaluating ? 'animate-spin' : ''}`}>
              {evaluating ? 'sync' : 'auto_graph'}
            </span>
            <span>{evaluating ? 'Evaluating Telemetry...' : 'Run Deterministic Evaluation'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="p-md rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300 flex items-center gap-3">
          <span className="material-symbols-outlined text-green-500">check_circle</span>
          <p className="font-body-md text-body-md font-medium">{actionSuccessMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-md rounded-lg bg-error/10 border border-error/20 text-error flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="font-body-md text-body-md font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Overview Analytics Metrics */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {/* Card 1: Total Evaluated */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Active Headcount Evaluated
              </span>
              <span className="material-symbols-outlined text-primary">groups</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                {summary.totalEvaluatedEmployees}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                across {Object.keys(summary.departmentBreakdown || {}).length} departments
              </span>
            </div>
          </div>

          {/* Card 2: Active Risks */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Active Risk Profiles
              </span>
              <span className="material-symbols-outlined text-amber-500">warning</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-on-surface">
                {summary.totalActiveRisks}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                flagged across {summary.employeesAtRisk} individuals
              </span>
            </div>
          </div>

          {/* Card 3: Critical Risks */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            {summary.critical > 0 && (
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full pointer-events-none" />
            )}
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-red-500 font-semibold flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping mr-1" />
                Critical Threats
              </span>
              <span className="material-symbols-outlined text-red-500">crisis_alert</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-red-600 dark:text-red-400">
                {summary.critical}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                require immediate 48h intervention
              </span>
            </div>
          </div>

          {/* Card 4: High Priority */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-sm">
              <span className="font-label-md text-label-md text-amber-600 dark:text-amber-400 font-semibold">
                High Priority Watchlist
              </span>
              <span className="material-symbols-outlined text-amber-500">notification_important</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-black text-amber-600 dark:text-amber-400">
                {summary.high}
              </span>
              <span className="text-on-surface-variant font-body-sm text-xs">
                30-day intervention cycle
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Telemetry Distribution Bars */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {/* Department Breakdown */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant">
            <h3 className="font-title-md text-title-md font-bold text-on-surface mb-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">domain</span>
              Departmental Risk Density
            </h3>
            <div className="space-y-sm">
              {Object.entries(summary.departmentBreakdown || {}).map(([dept, count]) => {
                const pct = summary.totalActiveRisks > 0 ? (count / summary.totalActiveRisks) * 100 : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-body-sm font-medium">
                      <span className="text-on-surface">{dept}</span>
                      <span className="text-on-surface-variant">
                        {count} risks ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Type Distribution */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant">
            <h3 className="font-title-md text-title-md font-bold text-on-surface mb-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">pie_chart</span>
              Risk Category Telemetry
            </h3>
            <div className="grid grid-cols-2 gap-sm">
              {Object.entries(summary.riskTypeBreakdown || {}).map(([type, count]) => {
                const info = getRiskTypeBadge(type);
                return (
                  <div
                    key={type}
                    onClick={() => setRiskTypeFilter(riskTypeFilter === type ? 'all' : type)}
                    className={`p-sm rounded-lg border transition-all cursor-pointer ${
                      riskTypeFilter === type
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant bg-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-xl ${info.color}`}>
                        {info.icon}
                      </span>
                      <span className="text-xs font-semibold text-on-surface capitalize truncate">
                        {type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-headline-sm text-xl font-bold text-on-surface">{count}</span>
                      <span className="text-[11px] text-on-surface-variant">active</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-md">
        <div className="flex flex-col md:flex-row gap-md items-center justify-between">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-xl">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, ID, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Design">Product & Design</option>
              <option value="Sales & Marketing">Sales & Marketing</option>
              <option value="Operations & HR">Operations & HR</option>
              <option value="Finance">Finance</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical (75-100)</option>
              <option value="high">High (50-74)</option>
              <option value="medium">Medium (25-49)</option>
              <option value="low">Low (0-24)</option>
            </select>

            {/* Risk Type Filter */}
            <select
              value={riskTypeFilter}
              onChange={(e) => setRiskTypeFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Categories</option>
              <option value="burnout">Burnout</option>
              <option value="attrition">Attrition</option>
              <option value="disengagement">Disengagement</option>
              <option value="skill_stagnation">Skill Stagnation</option>
            </select>

            {(departmentFilter !== 'all' || severityFilter !== 'all' || riskTypeFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setDepartmentFilter('all');
                  setSeverityFilter('all');
                  setRiskTypeFilter('all');
                  setSearchQuery('');
                }}
                className="px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Employee Risk Telemetry Table */}
      <div className="rounded-xl bg-surface-container-low border border-outline-variant overflow-hidden shadow-sm">
        <div className="p-md border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Active Workforce Risk Inventory ({filteredRisks.length})
          </h2>
          <span className="text-body-sm text-on-surface-variant font-medium">
            Sorted by Risk Severity & Score
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary mb-3"></div>
            <p className="font-body-md text-on-surface-variant">Loading risk signals...</p>
          </div>
        ) : filteredRisks.length === 0 ? (
          <div className="p-xl text-center space-y-2">
            <span className="material-symbols-outlined text-green-500 text-5xl">verified</span>
            <h3 className="font-title-md text-title-md font-bold text-on-surface">
              No Active Risks Matching Criteria
            </h3>
            <p className="text-on-surface-variant font-body-sm max-w-md mx-auto">
              All telemetry signals for the selected filters are within healthy operational thresholds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-xs uppercase tracking-wider font-semibold border-b border-outline-variant">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Risk Category</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Top Empirical Evidence</th>
                  <th className="py-3 px-4 text-right">Diagnosis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-body-sm">
                {filteredRisks.map((risk) => {
                  const emp = risk.employeeId;
                  const typeInfo = getRiskTypeBadge(risk.riskType);
                  return (
                    <tr
                      key={risk._id}
                      className="hover:bg-surface-container transition-colors group cursor-pointer"
                      onClick={() => setSelectedRisk(risk)}
                    >
                      {/* Employee Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                            {emp?.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase() || 'EM'}
                          </div>
                          <div>
                            <div className="font-bold text-on-surface group-hover:text-primary transition-colors">
                              {emp?.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-on-surface-variant font-mono">
                              {emp?.employeeCode || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-on-surface">{emp?.roleTitle || 'N/A'}</div>
                        <div className="text-xs text-on-surface-variant">{emp?.department} • {emp?.level}</div>
                      </td>

                      {/* Risk Category */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-on-surface">
                          <span className={`material-symbols-outlined text-lg ${typeInfo.color}`}>
                            {typeInfo.icon}
                          </span>
                          <span className="capitalize">{risk.riskType.replace('_', ' ')}</span>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getSeverityBadgeClass(
                            risk.severity
                          )}`}
                        >
                          {risk.severity}
                        </span>
                      </td>

                      {/* Score Gauge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-on-surface w-8">{risk.score}</span>
                          <div className="w-20 bg-surface-container-highest h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                risk.score >= 75
                                  ? 'bg-red-500'
                                  : risk.score >= 50
                                  ? 'bg-amber-500'
                                  : risk.score >= 25
                                  ? 'bg-yellow-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${risk.score}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Evidence Snippet */}
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-on-surface-variant">
                        {risk.evidence && risk.evidence.length > 0 ? (
                          <span className="font-mono bg-surface px-1.5 py-0.5 rounded border border-outline-variant">
                            {risk.evidence[0].metric}: {risk.evidence[0].observedValue}
                          </span>
                        ) : (
                          <span>Multi-signal pattern</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRisk(risk);
                          }}
                          className="px-3 py-1 bg-surface-container text-primary font-semibold text-xs rounded-lg hover:bg-primary hover:text-on-primary transition-all inline-flex items-center gap-1"
                        >
                          <span>Diagnosis</span>
                          <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL DIAGNOSIS & ACTION PLAN DRAWER / MODAL */}
      {selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-on-background/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in">
            {/* Drawer Header */}
            <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-black text-lg flex items-center justify-center">
                  {selectedRisk.employeeId?.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || 'EM'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {selectedRisk.employeeId?.name}
                    </h2>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                      {selectedRisk.employeeId?.employeeCode}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    {selectedRisk.employeeId?.roleTitle} • {selectedRisk.employeeId?.department} ({selectedRisk.employeeId?.level})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRisk(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Risk Index Banner */}
            <div className="px-lg py-md bg-surface-container border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-body-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                  Risk Assessment:
                </span>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getSeverityBadgeClass(
                    selectedRisk.severity
                  )}`}
                >
                  {selectedRisk.severity} {selectedRisk.riskType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs text-on-surface-variant">DETERMINISTIC INDEX:</span>
                <span className="text-lg font-black text-on-surface">{selectedRisk.score} / 100</span>
              </div>
            </div>

            {/* Scrollable Content: 4 Core Sections */}
            <div className="flex-1 overflow-y-auto p-lg space-y-lg">
              {/* SECTION 1: WHAT HAPPENED? */}
              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base">visibility</span>
                  WHAT HAPPENED?
                </div>
                <p className="text-on-surface font-body-md leading-relaxed">
                  {selectedRisk.whatHappened || selectedRisk.aiExplanation}
                </p>
              </div>

              {/* SECTION 2: WHY IT MATTERS? */}
              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base">report_problem</span>
                  WHY IT MATTERS?
                </div>
                <p className="text-on-surface font-body-md leading-relaxed">
                  {selectedRisk.whyItMatters ||
                    'Observed telemetry indicates a compounding operational bottleneck that poses immediate flight and performance degradation risks.'}
                </p>
              </div>

              {/* SECTION 3: SUPPORTING EVIDENCE */}
              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">database</span>
                    SUPPORTING EVIDENCE (EMPIRICAL SIGNALS)
                  </div>
                  <span className="text-xs text-on-surface-variant">Ground Truth Telemetry</span>
                </div>

                <div className="space-y-2">
                  {selectedRisk.evidence && selectedRisk.evidence.length > 0 ? (
                    selectedRisk.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="p-sm rounded-lg bg-surface border border-outline-variant flex items-center justify-between gap-4"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary uppercase font-mono">
                              [{ev.signalType}]
                            </span>
                            <span className="text-body-sm font-semibold text-on-surface font-mono">
                              {ev.metric}
                            </span>
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            Benchmark baseline: <span className="font-mono">{ev.benchmark}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-body-sm font-black text-on-surface font-mono">
                            {ev.observedValue}
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              ev.significance === 'high'
                                ? 'bg-red-500/15 text-red-500'
                                : 'bg-amber-500/15 text-amber-500'
                            }`}
                          >
                            {ev.significance} significance
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-on-surface-variant text-xs">No explicit evidence items logged.</p>
                  )}
                </div>
              </div>

              {/* SECTION 4: RECOMMENDED ACTIONS */}
              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">task_alt</span>
                    RECOMMENDED ACTIONS
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {selectedRisk.recommendedActions?.length || 0} Prescriptive Steps
                  </span>
                </div>

                <div className="space-y-sm">
                  {selectedRisk.recommendedActions && selectedRisk.recommendedActions.length > 0 ? (
                    selectedRisk.recommendedActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="p-sm rounded-lg bg-surface border border-outline-variant space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-body-sm text-on-surface">
                            {action.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              action.urgency === 'immediate'
                                ? 'bg-red-500/15 text-red-500'
                                : action.urgency === 'short_term'
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-blue-500/15 text-blue-500'
                            }`}
                          >
                            {action.urgency.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {action.rationale}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-on-surface-variant text-xs">No recommended actions available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-md border-t border-outline-variant bg-surface-container flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-mono">
                Evaluated: {new Date(selectedRisk.evaluatedAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => setSelectedRisk(null)}
                className="px-md py-sm bg-surface-container-high text-on-surface font-semibold text-xs rounded-lg hover:bg-outline-variant transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
