'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface IOnboardingMilestone {
  milestoneId: string;
  title: string;
  description: string;
  category: 'compliance' | 'technical_setup' | 'team_integration' | 'role_training';
  dueDay: number;
  completed: boolean;
  completedAt?: string;
  verifiedBy?: string;
  notes?: string;
  targetDate?: string;
  resourceLink?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

interface IAdaptationRecord {
  adaptedAt: string;
  trigger: 'manual' | 'ai_velocity_check' | 'delay_escalation';
  reason: string;
  suggestedAdjustments: string[];
  appliedBy?: string;
}

interface IOnboardingCheckpoint {
  day: number;
  completed: boolean;
  completedAt?: string;
  rating?: number;
  notes?: string;
}

interface OnboardingPlanItem {
  _id: string;
  roleTitle: string;
  department: string;
  mentorName?: string;
  startDate: string;
  targetCompletionDate: string;
  overallProgress: number;
  status: 'on_track' | 'delayed' | 'completed';
  velocityScore?: number;
  aiGuidanceNotes?: string;
  milestones: IOnboardingMilestone[];
  adaptationHistory?: IAdaptationRecord[];
  checkpoints?: IOnboardingCheckpoint[];
  createdAt: string;
  updatedAt: string;
  employeeId?: {
    _id: string;
    name: string;
    email: string;
    employeeCode: string;
    department: string;
    roleTitle: string;
    level: string;
    status: string;
    joiningDate: string;
    location?: string;
    skills?: Array<{ name: string; proficiency: string; verified: boolean }>;
    managerName?: string;
  };
}

interface OnboardingSummary {
  totalPlans: number;
  totalActiveOnboarding: number;
  onTrackCount: number;
  onTrackPct: number;
  delayedCount: number;
  completedCount: number;
  avgCompletionPct: number;
  avgVelocityScore: number;
}

interface EligibleEmployee {
  _id: string;
  name: string;
  employeeCode: string;
  department: string;
  roleTitle: string;
  level: string;
  joiningDate: string;
  managerName?: string;
}

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data states
  const [plans, setPlans] = useState<OnboardingPlanItem[]>([]);
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Plan Drawer / Modal
  const [selectedPlan, setSelectedPlan] = useState<OnboardingPlanItem | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [togglingMilestoneId, setTogglingMilestoneId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  // New Onboarding Plan Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [mentorInput, setMentorInput] = useState('');
  const [startDateInput, setStartDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [useAiToggle, setUseAiToggle] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Role Protection
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch Onboarding Plans
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/hr/onboarding?${params.toString()}`, {
        headers: {
          'X-CareerGenie-Role': user?.role || 'recruiter'
        }
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error('Access denied: Recruiter or Administrator role required.');
        throw new Error('Failed to retrieve onboarding plans.');
      }

      const data = await res.json();
      setPlans(data.plans || []);
      setSummary(data.summary || null);

      // Keep selected plan in sync if one is currently open
      if (selectedPlan) {
        const updated = (data.plans || []).find((p: OnboardingPlanItem) => p._id === selectedPlan._id);
        if (updated) setSelectedPlan(updated);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching onboarding plans.');
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, statusFilter, searchQuery, user?.role, selectedPlan]);

  useEffect(() => {
    if (user && (user.role === 'recruiter' || user.role === 'admin')) {
      fetchPlans();
    }
  }, [departmentFilter, statusFilter, searchQuery]);

  // Fetch Eligible Employees for New Onboarding Plan Modal
  const openCreateModal = async () => {
    setShowCreateModal(true);
    setLoadingEligible(true);
    try {
      const res = await fetch('/api/hr/onboarding?eligible=true', {
        headers: {
          'X-CareerGenie-Role': user?.role || 'recruiter'
        }
      });
      const data = await res.json();
      setEligibleEmployees(data.eligibleEmployees || []);
      if (data.eligibleEmployees && data.eligibleEmployees.length > 0) {
        setSelectedEmployeeId(data.eligibleEmployees[0]._id);
        setMentorInput(data.eligibleEmployees[0].managerName || '');
      }
    } catch (err) {
      console.error('Failed to fetch eligible employees:', err);
    } finally {
      setLoadingEligible(false);
    }
  };

  // Generate New Plan Submission
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;

    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/hr/onboarding/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          mentorName: mentorInput.trim() || undefined,
          startDate: startDateInput ? new Date(startDateInput) : undefined,
          useAi: useAiToggle
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate onboarding plan.');
      }

      setSuccessMsg(`Adaptive onboarding roadmap created for ${data.plan?.roleTitle || 'employee'}.`);
      setShowCreateModal(false);
      setSelectedPlan(data.plan);
      await fetchPlans();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate plan.');
    } finally {
      setGenerating(false);
    }
  };

  // Toggle Milestone Completion
  const handleToggleMilestone = async (milestoneId: string, currentCompleted: boolean) => {
    if (!selectedPlan) return;
    setTogglingMilestoneId(milestoneId);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/hr/onboarding/${selectedPlan._id}/milestone`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({
          milestoneId,
          completed: !currentCompleted,
          verifiedBy: user?.name || 'HR Recruiter'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update milestone.');
      }

      setSelectedPlan(data.plan);
      setSuccessMsg(`Milestone '${milestoneId}' marked as ${!currentCompleted ? 'completed' : 'reopened'}.`);
      await fetchPlans();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update milestone.');
    } finally {
      setTogglingMilestoneId(null);
    }
  };

  // Save Milestone Notes
  const handleSaveNotes = async (milestoneId: string) => {
    if (!selectedPlan) return;
    try {
      const milestone = selectedPlan.milestones.find((m) => m.milestoneId === milestoneId);
      const res = await fetch(`/api/hr/onboarding/${selectedPlan._id}/milestone`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({
          milestoneId,
          completed: milestone ? milestone.completed : false,
          notes: notesDraft
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedPlan(data.plan);
        setEditingNotesId(null);
        setSuccessMsg('Milestone notes updated.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save notes.');
    }
  };

  // Run Adaptive AI Check
  const handleRunAdaptiveCheck = async () => {
    if (!selectedPlan) return;
    setAdapting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/hr/onboarding/${selectedPlan._id}/adapt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({ useAi: true })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run adaptive onboarding check.');
      }

      setSelectedPlan(data.plan);
      setSuccessMsg(
        `Adaptive check completed (${data.usedGemini ? 'Gemini 2.5 Flash' : 'Deterministic Engine'}). Velocity: ${data.diagnosis?.velocityScore || 100}/100.`
      );
      await fetchPlans();
    } catch (err: any) {
      setErrorMsg(err.message || 'Adaptive check failed.');
    } finally {
      setAdapting(false);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant font-label-md">Loading Onboarding Orchestrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">assignment_ind</span>
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface">Adaptive Onboarding Orchestrator</h1>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Personalized 30-60-90 day milestone roadmaps, real-time ramp velocity tracking, and policy-grounded adaptive intervention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlans}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low text-on-surface transition-colors"
            title="Refresh onboarding status"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Onboard New Hire
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center justify-between p-4 bg-error-container text-on-error-container rounded-xl text-sm border border-error/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-black/10 rounded">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 rounded-xl text-sm border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-black/10 rounded">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Active Onboarding</span>
            <span className="material-symbols-outlined text-primary text-xl">group</span>
          </div>
          <div className="mt-2 text-2xl font-black text-on-surface">
            {summary ? summary.totalActiveOnboarding : 0}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Across all departments</p>
        </div>

        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">On-Track Rate</span>
            <span className="material-symbols-outlined text-emerald-600 text-xl">trending_up</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary ? `${summary.onTrackPct}%` : '100%'}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">
            {summary ? `${summary.onTrackCount} on schedule` : '0 on schedule'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Delayed / At Risk</span>
            <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>
          </div>
          <div className={`mt-2 text-2xl font-black ${summary && summary.delayedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface'}`}>
            {summary ? summary.delayedCount : 0}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Needs adaptive intervention</p>
        </div>

        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Avg Completion</span>
            <span className="material-symbols-outlined text-blue-500 text-xl">donut_large</span>
          </div>
          <div className="mt-2 text-2xl font-black text-on-surface">
            {summary ? `${summary.avgCompletionPct}%` : '0%'}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Across active roadmaps</p>
        </div>

        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Avg Velocity Index</span>
            <span className="material-symbols-outlined text-purple-500 text-xl">speed</span>
          </div>
          <div className="mt-2 text-2xl font-black text-on-surface">
            {summary ? `${summary.avgVelocityScore}/100` : '100/100'}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Milestones completed vs due</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
          <input
            type="text"
            placeholder="Search by new hire name, role title, employee code, or mentor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-hidden focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-on-surface-variant">Department:</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Design">Product & Design</option>
              <option value="Sales & Marketing">Sales & Marketing</option>
              <option value="Operations & HR">Operations & HR</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-on-surface-variant">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="on_track">On Track</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Onboarding Plans Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl border border-outline-variant bg-surface animate-pulse space-y-4">
              <div className="h-4 bg-outline-variant/40 rounded w-1/3" />
              <div className="h-6 bg-outline-variant/40 rounded w-2/3" />
              <div className="h-2 bg-outline-variant/40 rounded w-full" />
              <div className="h-4 bg-outline-variant/40 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 p-8 rounded-xl border border-dashed border-outline-variant bg-surface">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">sentiment_dissatisfied</span>
          <h3 className="text-lg font-bold text-on-surface mt-2">No Onboarding Plans Found</h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto mt-1">
            No active onboarding roadmaps match the selected filters. Use "Onboard New Hire" to initialize a personalized plan.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-all inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Onboard New Hire
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const emp = plan.employeeId;
            const completedCount = plan.milestones.filter((m) => m.completed).length;
            const totalCount = plan.milestones.length;
            const overdueCount = plan.milestones.filter((m) => m.status === 'overdue').length;

            return (
              <div
                key={plan._id}
                className="group relative rounded-xl border border-outline-variant bg-surface hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Top Status Accent Bar */}
                <div
                  className={`h-1.5 w-full ${
                    plan.status === 'completed'
                      ? 'bg-blue-500'
                      : plan.status === 'delayed'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />

                <div className="p-5 space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                          {emp ? emp.name : 'Unknown Employee'}
                        </h3>
                        {emp && (
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                            {emp.employeeCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {plan.roleTitle} &bull; <span className="font-medium text-on-surface">{plan.department}</span>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-full shrink-0 ${
                        plan.status === 'completed'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : plan.status === 'delayed'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {plan.status === 'delayed' ? 'Delayed' : plan.status === 'completed' ? 'Completed' : 'On Track'}
                    </span>
                  </div>

                  {/* Mentor & Timeline info */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant pt-1 border-t border-outline-variant/40">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-on-surface-variant/80">Mentor / Buddy</span>
                      <span className="font-medium text-on-surface truncate block" title={plan.mentorName || 'Unassigned'}>
                        {plan.mentorName || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-on-surface-variant/80">Start Date</span>
                      <span className="font-medium text-on-surface">
                        {new Date(plan.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Velocity Metric */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-on-surface">
                        Progress: <span className="text-primary">{plan.overallProgress}%</span>
                      </span>
                      <span className="text-on-surface-variant text-[11px]">
                        {completedCount} of {totalCount} milestones
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          plan.status === 'completed'
                            ? 'bg-blue-500'
                            : plan.status === 'delayed'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${plan.overallProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Velocity & Overdue Indicators */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-xs text-purple-500">speed</span>
                      Velocity: <strong className="text-on-surface">{typeof plan.velocityScore === 'number' ? plan.velocityScore : 100}/100</strong>
                    </span>

                    {overdueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        {overdueCount} Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-xs">check</span>
                        Pacing Well
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-surface-container-lowest/60 border-t border-outline-variant/50 flex justify-end">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 py-1 px-2 rounded hover:bg-surface-container-low transition-colors"
                  >
                    Inspect Roadmap
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL / DRAWER */}
      {/* ========================================================================= */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant bg-surface flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-on-surface">
                    {selectedPlan.employeeId ? selectedPlan.employeeId.name : selectedPlan.roleTitle}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full ${
                      selectedPlan.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        : selectedPlan.status === 'delayed'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {selectedPlan.status === 'delayed' ? 'Delayed' : selectedPlan.status === 'completed' ? 'Completed' : 'On Track'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  {selectedPlan.roleTitle} &bull; {selectedPlan.department} &bull; Mentor: <strong className="text-on-surface">{selectedPlan.mentorName || 'Unassigned'}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAdaptiveCheck}
                  disabled={adapting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors shadow-xs"
                  title="Run AI velocity analysis and schedule adaptation"
                >
                  <span className={`material-symbols-outlined text-sm ${adapting ? 'animate-spin' : 'text-primary'}`}>
                    {adapting ? 'refresh' : 'psychology'}
                  </span>
                  {adapting ? 'Analyzing...' : 'Run Adaptive Check'}
                </button>

                <button
                  onClick={() => setSelectedPlan(null)}
                  className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-on-surface">
              {/* Progress & Velocity Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Overall Progress</span>
                  <div className="text-xl font-black text-primary mt-0.5">{selectedPlan.overallProgress}%</div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${selectedPlan.overallProgress}%` }}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Velocity Score</span>
                  <div className="text-xl font-black text-on-surface mt-0.5">
                    {typeof selectedPlan.velocityScore === 'number' ? selectedPlan.velocityScore : 100}
                    <span className="text-xs font-normal text-on-surface-variant"> / 100</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1">Deterministic pace index</p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Target Date</span>
                  <div className="text-base font-bold text-on-surface mt-0.5">
                    {new Date(selectedPlan.targetCompletionDate).toLocaleDateString()}
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1">90-day ramp window</p>
                </div>
              </div>

              {/* AI Guidance & Diagnostic Diagnosis Banner */}
              {selectedPlan.aiGuidanceNotes && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">psychology</span>
                    <h4 className="font-semibold text-xs text-primary uppercase tracking-wider">Adaptive Intelligence Guidance</h4>
                  </div>
                  <p className="text-xs text-on-surface leading-relaxed">{selectedPlan.aiGuidanceNotes}</p>
                </div>
              )}

              {/* 30 / 60 / 90 Checkpoints */}
              {selectedPlan.checkpoints && selectedPlan.checkpoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">30 / 60 / 90 Checkpoints</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {selectedPlan.checkpoints.map((cp) => (
                      <div
                        key={cp.day}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          cp.completed
                            ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-outline-variant bg-surface'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-on-surface">Day {cp.day} Checkpoint</div>
                          <div className="text-[11px] text-on-surface-variant truncate max-w-[160px]">{cp.notes || 'Formal ramp check'}</div>
                        </div>
                        <span
                          className={`material-symbols-outlined text-base ${
                            cp.completed ? 'text-emerald-600' : 'text-on-surface-variant/40'
                          }`}
                        >
                          {cp.completed ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Milestones Roadmap */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Milestone Roadmap ({selectedPlan.milestones.filter((m) => m.completed).length} / {selectedPlan.milestones.length} Completed)
                  </h4>
                  <span className="text-[11px] text-on-surface-variant">Click checkbox to update milestone completion</span>
                </div>

                <div className="space-y-2.5">
                  {selectedPlan.milestones.map((milestone) => {
                    const isToggling = togglingMilestoneId === milestone.milestoneId;
                    const isOverdue = milestone.status === 'overdue' && !milestone.completed;

                    return (
                      <div
                        key={milestone.milestoneId}
                        className={`p-3.5 rounded-xl border transition-all ${
                          milestone.completed
                            ? 'border-outline-variant/60 bg-surface-container-lowest/50'
                            : isOverdue
                            ? 'border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10'
                            : 'border-outline-variant bg-surface'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleMilestone(milestone.milestoneId, milestone.completed)}
                            disabled={isToggling}
                            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                              milestone.completed
                                ? 'bg-primary border-primary text-on-primary'
                                : 'border-outline-variant hover:border-primary bg-surface'
                            }`}
                          >
                            {isToggling ? (
                              <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : milestone.completed ? (
                              <span className="material-symbols-outlined text-sm font-bold">check</span>
                            ) : null}
                          </button>

                          {/* Content */}
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-primary">{milestone.milestoneId}</span>
                                <h5
                                  className={`text-sm font-semibold ${
                                    milestone.completed ? 'line-through text-on-surface-variant' : 'text-on-surface'
                                  }`}
                                >
                                  {milestone.title}
                                </h5>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Category Badge */}
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-surface-container-high text-on-surface-variant uppercase">
                                  {milestone.category.replace('_', ' ')}
                                </span>

                                {/* Status Tag */}
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                                    milestone.completed
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : isOverdue
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-surface-container-highest text-on-surface-variant'
                                  }`}
                                >
                                  {milestone.completed ? 'Done' : isOverdue ? 'Overdue' : `Day ${milestone.dueDay}`}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-on-surface-variant leading-relaxed">{milestone.description}</p>

                            {/* Resource Link & Notes */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                              <div className="flex items-center gap-3">
                                {milestone.resourceLink && (
                                  <Link
                                    href="/hr/policies"
                                    className="text-primary hover:underline inline-flex items-center gap-1 font-mono text-[10px]"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">link</span>
                                    {milestone.resourceLink}
                                  </Link>
                                )}

                                {milestone.completedAt && (
                                  <span className="text-on-surface-variant/80">
                                    Completed: {new Date(milestone.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              {/* Notes Button */}
                              {editingNotesId === milestone.milestoneId ? (
                                <div className="w-full flex items-center gap-2 mt-2">
                                  <input
                                    type="text"
                                    value={notesDraft}
                                    onChange={(e) => setNotesDraft(e.target.value)}
                                    placeholder="Add verification notes or blocker details..."
                                    className="flex-1 px-2.5 py-1 text-xs rounded border border-outline-variant bg-surface text-on-surface"
                                  />
                                  <button
                                    onClick={() => handleSaveNotes(milestone.milestoneId)}
                                    className="px-2.5 py-1 bg-primary text-on-primary rounded text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotesId(null)}
                                    className="px-2 py-1 text-xs text-on-surface-variant"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingNotesId(milestone.milestoneId);
                                    setNotesDraft(milestone.notes || '');
                                  }}
                                  className="text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1 hover:underline"
                                >
                                  <span className="material-symbols-outlined text-[12px]">edit_note</span>
                                  {milestone.notes ? `Note: "${milestone.notes}"` : 'Add note'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Adaptation History Log */}
              {selectedPlan.adaptationHistory && selectedPlan.adaptationHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-outline-variant/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Adaptation Audit Log</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedPlan.adaptationHistory.map((hist, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/50 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                          <span className="font-semibold uppercase tracking-wider text-primary">
                            Trigger: {hist.trigger.replace('_', ' ')}
                          </span>
                          <span>{new Date(hist.adaptedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-on-surface">{hist.reason}</p>
                        {hist.suggestedAdjustments && hist.suggestedAdjustments.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-on-surface-variant space-y-0.5 pt-0.5">
                            {hist.suggestedAdjustments.map((adj, aIdx) => (
                              <li key={aIdx}>{adj}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant bg-surface flex justify-end">
              <button
                onClick={() => setSelectedPlan(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW ONBOARDING PLAN MODAL */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                <h3 className="font-bold text-lg text-on-surface">Generate Adaptive Onboarding Roadmap</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="p-5 space-y-4 text-xs">
              {/* Employee Selection */}
              <div>
                <label className="block font-semibold text-on-surface mb-1">Select New Hire / Employee</label>
                {loadingEligible ? (
                  <div className="py-2 text-on-surface-variant animate-pulse">Loading active workforce...</div>
                ) : eligibleEmployees.length === 0 ? (
                  <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface-variant">
                    All current employees already have an assigned onboarding plan.
                  </div>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      const found = eligibleEmployees.find((emp) => emp._id === e.target.value);
                      if (found && found.managerName) setMentorInput(found.managerName);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-xs focus:ring-1 focus:ring-primary"
                    required
                  >
                    {eligibleEmployees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} ({emp.employeeCode}) — {emp.roleTitle}, {emp.department} ({emp.level})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Mentor Input */}
              <div>
                <label className="block font-semibold text-on-surface mb-1">Assigned Mentor / Buddy</label>
                <input
                  type="text"
                  value={mentorInput}
                  onChange={(e) => setMentorInput(e.target.value)}
                  placeholder="e.g. Zoe Kim (Senior UI Designer)"
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-xs"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block font-semibold text-on-surface mb-1">Official Start Date</label>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-xs"
                  required
                />
              </div>

              {/* AI Adaptive Generation Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="useAiToggle"
                  checked={useAiToggle}
                  onChange={(e) => setUseAiToggle(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="useAiToggle" className="text-xs text-on-surface font-medium cursor-pointer">
                  Use Gemini 2.5 Flash to personalize roadmap to candidate skills and verified policies
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || !selectedEmployeeId}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 flex items-center gap-2 shadow-xs"
                >
                  {generating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      Synthesizing Roadmap...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">rocket_launch</span>
                      Generate Plan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
