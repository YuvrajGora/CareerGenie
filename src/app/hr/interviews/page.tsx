'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================

export type InterviewStage = 'screen' | 'technical' | 'system_design' | 'culture_fit' | 'final';
export type InterviewRecommendation = 'strong_hire' | 'hire' | 'borderline' | 'do_not_hire';

interface ICompetency {
  competency: string;
  score: number;
  weight: number;
  feedback: string;
  keySignals: string[];
}

interface InterviewEvaluationItem {
  _id: string;
  candidateId: {
    _id: string;
    name: string;
    email: string;
    skills: string[];
    education?: string;
    yearsOfExperience?: number;
    careerLevel?: string;
  };
  jobId: {
    _id: string;
    title: string;
    company: string;
    location: string;
    experience: number;
    requiredSkills: string[];
  };
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewStage: InterviewStage;
  overallScore: number;
  recommendation: InterviewRecommendation;
  competencies: ICompetency[];
  strengthsSummary: string[];
  concernsSummary: string[];
  rawInterviewNotes?: string;
  aiSynthesis?: string;
  conductedAt: string;
  createdAt: string;
}

interface InterviewKPIs {
  totalInterviews: number;
  strongHirePct: number;
  averageScore: number;
  stageDistribution: Record<InterviewStage, number>;
  recommendationDistribution: Record<InterviewRecommendation, number>;
}

interface EligibleCandidate {
  applicationId: string;
  status: string;
  appliedAt: string;
  matchScore: number;
  matchBreakdown?: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
  } | null;
  candidate: {
    _id: string;
    name: string;
    email: string;
    skills: string[];
    education?: string;
    yearsOfExperience?: number;
    careerLevel?: string;
    profileImage?: string;
  };
  job: {
    _id: string;
    title: string;
    company: string;
    location: string;
    requiredSkills: string[];
    experience: number;
  };
  existingEvaluations?: Array<{
    interviewStage: InterviewStage;
    overallScore: number;
    recommendation: InterviewRecommendation;
    conductedAt: string;
  }>;
}

interface TargetedQuestion {
  question: string;
  competency: string;
  lookFors: string[];
  redFlags: string[];
}

// Stage labels & color mappings
const STAGE_LABELS: Record<InterviewStage, string> = {
  screen: 'Recruiter Screen',
  technical: 'Technical Deep-Dive',
  system_design: 'System Design',
  culture_fit: 'Culture & Collaboration',
  final: 'Executive Final'
};

const STAGE_BADGE_CLASSES: Record<InterviewStage, string> = {
  screen: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  technical: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  system_design: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  culture_fit: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  final: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
};

const RECOMMENDATION_STYLES: Record<InterviewRecommendation, { label: string; badge: string; pill: string }> = {
  strong_hire: {
    label: 'Strong Hire',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    pill: 'bg-emerald-500 text-white'
  },
  hire: {
    label: 'Hire',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    pill: 'bg-blue-500 text-white'
  },
  borderline: {
    label: 'Borderline',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    pill: 'bg-amber-500 text-white'
  },
  do_not_hire: {
    label: 'Do Not Hire',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    pill: 'bg-red-500 text-white'
  }
};

function InterviewIntelligenceContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data states
  const [evaluations, setEvaluations] = useState<InterviewEvaluationItem[]>([]);
  const [summary, setSummary] = useState<InterviewKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<InterviewEvaluationItem | null>(null);

  // Filters
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Conduct Interview Modal states
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [eligibleCandidates, setEligibleCandidates] = useState<EligibleCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>('');
  const [modalStage, setModalStage] = useState<InterviewStage>('screen');
  const [interviewerNameInput, setInterviewerNameInput] = useState<string>('');
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [targetedQuestions, setTargetedQuestions] = useState<TargetedQuestion[]>([]);
  const [rubricCompetencies, setRubricCompetencies] = useState<ICompetency[]>([]);
  const [rawNotesInput, setRawNotesInput] = useState<string>('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  // Role validation & authorization redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    } else if (!authLoading && user && user.role === 'student') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch Evaluations
  const fetchEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      if (stageFilter !== 'all') params.append('interviewStage', stageFilter);
      if (recommendationFilter !== 'all') params.append('recommendation', recommendationFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await fetch(`/api/hr/interviews?${params.toString()}`, {
        headers: {
          'X-CareerGenie-Role': user?.role || 'recruiter'
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load interview evaluations.');
      }

      const data = await res.json();
      setEvaluations(data.evaluations || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('Error fetching evaluations:', err);
      setErrorMsg(err.message || 'Failed to load interview evaluations.');
    } finally {
      setLoading(false);
    }
  }, [stageFilter, recommendationFilter, searchTerm, user?.role]);

  useEffect(() => {
    if (user && user.role !== 'student') {
      fetchEvaluations();
    }
  }, [fetchEvaluations, user]);

  // Check URL query param e.g. /hr/interviews?applicationId=...
  useEffect(() => {
    const appQuery = searchParams.get('applicationId');
    if (appQuery && user && user.role !== 'student') {
      openConductModal(appQuery);
    }
  }, [searchParams, user]);

  // Fetch eligible candidates for evaluation modal
  const fetchEligibleCandidates = async (preselectAppId?: string) => {
    try {
      setLoadingCandidates(true);
      const res = await fetch('/api/hr/interviews?candidates=true', {
        headers: {
          'X-CareerGenie-Role': user?.role || 'recruiter'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const candList: EligibleCandidate[] = data.candidates || [];
        setEligibleCandidates(candList);

        if (preselectAppId) {
          setSelectedApplicationId(preselectAppId);
          loadQuestionsForApplication(preselectAppId, modalStage);
        } else if (candList.length > 0 && !selectedApplicationId) {
          setSelectedApplicationId(candList[0].applicationId);
          loadQuestionsForApplication(candList[0].applicationId, modalStage);
        }
      }
    } catch (err) {
      console.error('Failed to load eligible candidates:', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const openConductModal = (appId?: string) => {
    setShowEvaluateModal(true);
    setEvaluationResult(null);
    setRawNotesInput('');
    setInterviewerNameInput(user?.name ? `${user.name} (${user.role === 'admin' ? 'Admin' : 'Recruiter'})` : '');
    fetchEligibleCandidates(appId);
  };

  // Generate probe questions and stage rubric for selected candidate & stage
  const loadQuestionsForApplication = async (appId: string, stage: InterviewStage) => {
    if (!appId) return;
    try {
      setQuestionsLoading(true);
      setErrorMsg(null);

      const res = await fetch('/api/hr/interviews/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({
          applicationId: appId,
          interviewStage: stage
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate interview probe questions.');
      }

      setTargetedQuestions(data.questions || []);
      if (Array.isArray(data.defaultRubric)) {
        setRubricCompetencies(data.defaultRubric);
      }
    } catch (err: any) {
      console.error('Error generating questions:', err);
      setErrorMsg(err.message || 'Failed to generate questions.');
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleStageChange = (newStage: InterviewStage) => {
    setModalStage(newStage);
    if (selectedApplicationId) {
      loadQuestionsForApplication(selectedApplicationId, newStage);
    }
  };

  const handleCandidateChange = (newAppId: string) => {
    setSelectedApplicationId(newAppId);
    if (newAppId) {
      loadQuestionsForApplication(newAppId, modalStage);
    }
  };

  // Update competency score in modal
  const handleScoreChange = (index: number, newScore: number) => {
    setRubricCompetencies((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], score: newScore };
      return copy;
    });
  };

  // Update competency feedback in modal
  const handleFeedbackChange = (index: number, newFeedback: string) => {
    setRubricCompetencies((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], feedback: newFeedback };
      return copy;
    });
  };

  // Calculate live preview score in modal
  const liveOverallScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        rubricCompetencies.reduce((acc, c) => acc + (c.score || 3) * (c.weight || 0.25), 0) * 20
      )
    )
  );

  const liveRecommendation: InterviewRecommendation =
    liveOverallScore >= 85
      ? 'strong_hire'
      : liveOverallScore >= 70
      ? 'hire'
      : liveOverallScore >= 55
      ? 'borderline'
      : 'do_not_hire';

  // Submit interview evaluation
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicationId || rubricCompetencies.length === 0) return;

    try {
      setEvaluating(true);
      setErrorMsg(null);

      const res = await fetch('/api/hr/interviews/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({
          applicationId: selectedApplicationId,
          interviewStage: modalStage,
          interviewerName: interviewerNameInput.trim() || undefined,
          competencies: rubricCompetencies,
          rawInterviewNotes: rawNotesInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit interview evaluation.');
      }

      setEvaluationResult(data);
      setSuccessMsg(`Evaluation recorded: ${data.evaluation?.candidateName} scored ${data.evaluation?.overallScore}/100 (${data.evaluation?.recommendation?.replace('_', ' ').toUpperCase()}).`);
      await fetchEvaluations();
    } catch (err: any) {
      console.error('Error submitting evaluation:', err);
      setErrorMsg(err.message || 'Failed to submit evaluation.');
    } finally {
      setEvaluating(false);
    }
  };

  if (authLoading || (loading && evaluations.length === 0 && !summary)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-on-surface-variant">Loading Interview Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role === 'student') return null;

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">psychology_alt</span>
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface">Intelligent Interview Agent</h1>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Recruiter decision-support cockpit: targeted probe questions, deterministic competency scoring, and evidence-grounded AI synthesis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchEvaluations}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low text-on-surface transition-colors"
            title="Refresh evaluations"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>

          <button
            onClick={() => openConductModal()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">assignment_add</span>
            Evaluate Candidate
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Interviews */}
        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Total Interviews</span>
            <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
          </div>
          <div className="mt-2 text-2xl font-black text-on-surface">
            {summary ? summary.totalInterviews : 0}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Across all hiring pipelines</p>
        </div>

        {/* Strong Hire % */}
        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Strong Hire %</span>
            <span className="material-symbols-outlined text-emerald-600 text-xl">star</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary ? `${summary.strongHirePct}%` : '0%'}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">
            {summary ? `${summary.recommendationDistribution.strong_hire} candidates` : '0 candidates'}
          </p>
        </div>

        {/* Average Score */}
        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Average Score</span>
            <span className="material-symbols-outlined text-blue-500 text-xl">speed</span>
          </div>
          <div className="mt-2 text-2xl font-black text-on-surface">
            {summary ? `${summary.averageScore} / 100` : '0 / 100'}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Weighted competency benchmark</p>
        </div>

        {/* Stage Distribution */}
        <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Pipeline Stages</span>
            <span className="material-symbols-outlined text-purple-500 text-xl">pie_chart</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs">
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-[10px]">
              Screen: {summary?.stageDistribution.screen || 0}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-semibold text-[10px]">
              Tech: {summary?.stageDistribution.technical || 0}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold text-[10px]">
              Final: {summary?.stageDistribution.final || 0}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">Multi-stage evaluation tracking</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-outline-variant bg-surface">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stage filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">Stage:</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Stages</option>
              <option value="screen">Screen</option>
              <option value="technical">Technical</option>
              <option value="system_design">System Design</option>
              <option value="culture_fit">Culture Fit</option>
              <option value="final">Final Round</option>
            </select>
          </div>

          {/* Recommendation filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">Recommendation:</label>
            <select
              value={recommendationFilter}
              onChange={(e) => setRecommendationFilter(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Recommendations</option>
              <option value="strong_hire">Strong Hire</option>
              <option value="hire">Hire</option>
              <option value="borderline">Borderline</option>
              <option value="do_not_hire">Do Not Hire</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search candidate, role, or interviewer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Evaluations Table / Cards */}
      <div className="border border-outline-variant rounded-xl bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-container-low text-on-surface-variant font-semibold uppercase tracking-wider text-[11px] border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Target Role</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">Recommendation</th>
                <th className="py-3 px-4">Interviewer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {evaluations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                    <p className="font-semibold text-sm">No interview evaluations found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or click "Evaluate Candidate" to record a new session.</p>
                  </td>
                </tr>
              ) : (
                evaluations.map((ev) => {
                  const recStyle = RECOMMENDATION_STYLES[ev.recommendation] || RECOMMENDATION_STYLES.borderline;
                  const stageClass = STAGE_BADGE_CLASSES[ev.interviewStage] || 'bg-gray-100 text-gray-800';

                  return (
                    <tr
                      key={ev._id}
                      onClick={() => setSelectedEvaluation(ev)}
                      className="hover:bg-surface-container-low/70 transition-colors cursor-pointer group"
                    >
                      {/* Candidate */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-on-surface group-hover:text-primary transition-colors">
                          {ev.candidateName}
                        </div>
                        <div className="text-[11px] text-on-surface-variant">
                          {ev.candidateId?.email || 'Candidate'}
                        </div>
                      </td>

                      {/* Target Role */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-on-surface">{ev.roleTitle}</div>
                        <div className="text-[11px] text-on-surface-variant">{ev.jobId?.company || 'CareerGenie'}</div>
                      </td>

                      {/* Stage */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${stageClass}`}>
                          {STAGE_LABELS[ev.interviewStage] || ev.interviewStage}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-sm text-on-surface">
                          {ev.overallScore}
                        </span>
                        <span className="text-[10px] text-on-surface-variant"> / 100</span>
                      </td>

                      {/* Recommendation */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${recStyle.badge}`}>
                          {recStyle.label}
                        </span>
                      </td>

                      {/* Interviewer */}
                      <td className="py-3 px-4 text-on-surface-variant font-medium">
                        {ev.interviewerName}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-on-surface-variant">
                        {new Date(ev.conductedAt || ev.createdAt).toLocaleDateString()}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvaluation(ev);
                          }}
                          className="px-2.5 py-1 rounded text-primary hover:bg-primary/10 font-semibold transition-colors"
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL DRAWER (Slide-over from right) */}
      {selectedEvaluation && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface h-full shadow-2xl overflow-y-auto flex flex-col p-6 space-y-6 border-l border-outline-variant">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-outline-variant pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STAGE_BADGE_CLASSES[selectedEvaluation.interviewStage]}`}>
                    {STAGE_LABELS[selectedEvaluation.interviewStage]}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${RECOMMENDATION_STYLES[selectedEvaluation.recommendation].badge}`}>
                    {RECOMMENDATION_STYLES[selectedEvaluation.recommendation].label}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-on-surface mt-2">
                  {selectedEvaluation.candidateName}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {selectedEvaluation.roleTitle} • Conducted by {selectedEvaluation.interviewerName} on {new Date(selectedEvaluation.conductedAt).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedEvaluation(null)}
                className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Score Ring Summary */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Deterministic Overall Score</span>
                <div className="text-3xl font-black text-on-surface mt-1">
                  {selectedEvaluation.overallScore} <span className="text-sm font-normal text-on-surface-variant">/ 100</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Formula: Σ(score_i × weight_i) × 20 (clamped 0–100)
                </p>
              </div>

              <div className={`px-4 py-2 rounded-xl text-center font-bold text-sm ${RECOMMENDATION_STYLES[selectedEvaluation.recommendation].badge}`}>
                {RECOMMENDATION_STYLES[selectedEvaluation.recommendation].label}
              </div>
            </div>

            {/* AI Synthesis Summary */}
            {selectedEvaluation.aiSynthesis && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">smart_toy</span>
                  Evidence-Grounded AI Synthesis
                </div>
                <p className="text-xs text-on-surface leading-relaxed">
                  {selectedEvaluation.aiSynthesis}
                </p>
              </div>
            )}

            {/* Strengths & Concerns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Demonstrated Strengths
                </span>
                <ul className="text-xs space-y-1.5 text-on-surface">
                  {selectedEvaluation.strengthsSummary?.length ? (
                    selectedEvaluation.strengthsSummary.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-on-surface-variant italic">Baseline competency met.</li>
                  )}
                </ul>
              </div>

              {/* Concerns */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Gaps & Deliberation Areas
                </span>
                <ul className="text-xs space-y-1.5 text-on-surface">
                  {selectedEvaluation.concernsSummary?.length ? (
                    selectedEvaluation.concernsSummary.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{c}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-on-surface-variant italic">No major concerns noted.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Competency Breakdown Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">rule</span>
                Evaluated Competency Dimensions
              </h3>
              <div className="space-y-2">
                {selectedEvaluation.competencies?.map((comp, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-outline-variant bg-surface space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-on-surface">{comp.competency}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-on-surface-variant text-[11px]">Weight: {Math.round(comp.weight * 100)}%</span>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-black">
                          {comp.score} / 5
                        </span>
                      </div>
                    </div>
                    {comp.feedback && (
                      <p className="text-[11px] text-on-surface-variant italic">
                        "{comp.feedback}"
                      </p>
                    )}
                    {comp.keySignals && comp.keySignals.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {comp.keySignals.map((signal, sIdx) => (
                          <span key={sIdx} className="px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] text-on-surface-variant">
                            {signal}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Field Notes */}
            {selectedEvaluation.rawInterviewNotes && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Recruiter Field Notes
                </h3>
                <div className="p-3 rounded-lg border border-outline-variant/60 bg-surface-container-low font-mono text-[11px] text-on-surface whitespace-pre-wrap">
                  {selectedEvaluation.rawInterviewNotes}
                </div>
              </div>
            )}

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-outline-variant flex justify-end">
              <button
                onClick={() => setSelectedEvaluation(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONDUCT INTERVIEW / EVALUATE MODAL */}
      {showEvaluateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-3xl my-8 max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">psychology_alt</span>
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Conduct Interview & Evaluate Candidate</h2>
                  <p className="text-xs text-on-surface-variant">Intelligent decision-support agent</p>
                </div>
              </div>

              <button
                onClick={() => setShowEvaluateModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Step 1: Candidate & Stage Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Candidate */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Select Candidate Application *
                  </label>
                  {loadingCandidates ? (
                    <div className="h-9 bg-surface-container-high animate-pulse rounded-lg"></div>
                  ) : (
                    <select
                      value={selectedApplicationId}
                      onChange={(e) => handleCandidateChange(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:ring-1 focus:ring-primary"
                    >
                      {eligibleCandidates.map((cand) => (
                        <option key={cand.applicationId} value={cand.applicationId}>
                          {cand.candidate?.name} — {cand.job?.title} ({cand.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Select Stage */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Interview Stage *
                  </label>
                  <select
                    value={modalStage}
                    onChange={(e) => handleStageChange(e.target.value as InterviewStage)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:ring-1 focus:ring-primary"
                  >
                    <option value="screen">Screen (Recruiter Initial)</option>
                    <option value="technical">Technical Deep-Dive</option>
                    <option value="system_design">System Design & Architecture</option>
                    <option value="culture_fit">Culture Fit & Collaboration</option>
                    <option value="final">Final Round (Executive)</option>
                  </select>
                </div>
              </div>

              {/* Interviewer Name */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Interviewer Name / Role
                </label>
                <input
                  type="text"
                  value={interviewerNameInput}
                  onChange={(e) => setInterviewerNameInput(e.target.value)}
                  placeholder="e.g. Victoria Stone (Lead Technical Recruiter)"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Step 2: Targeted Questions & Look-fors / Red Flags */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">quiz</span>
                    Targeted Probe Questions ({STAGE_LABELS[modalStage]})
                  </h3>
                  {questionsLoading && (
                    <span className="text-[11px] text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                      Generating questions...
                    </span>
                  )}
                </div>

                {targetedQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {targetedQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-on-surface text-xs leading-snug">
                            {qIdx + 1}. {q.question}
                          </p>
                          <span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-semibold text-on-surface-variant shrink-0">
                            {q.competency}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
                          {/* Look fors */}
                          <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Look-fors:</span>
                            <ul className="space-y-0.5 text-on-surface-variant">
                              {q.lookFors?.map((lf, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-emerald-500 font-bold">+</span>
                                  <span>{lf}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Red flags */}
                          <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                            <span className="font-bold text-red-600 dark:text-red-400 block mb-1">Red Flags:</span>
                            <ul className="space-y-0.5 text-on-surface-variant">
                              {q.redFlags?.map((rf, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-red-500 font-bold">-</span>
                                  <span>{rf}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-outline-variant text-center text-on-surface-variant">
                    {questionsLoading ? 'Generating targeted probe questions...' : 'No probe questions loaded yet.'}
                  </div>
                )}
              </div>

              {/* Step 3: Recruiter Notes */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Interviewer Live Notes
                </label>
                <textarea
                  rows={3}
                  value={rawNotesInput}
                  onChange={(e) => setRawNotesInput(e.target.value)}
                  placeholder="Record observations, candidate responses, technical depth, or communication signals..."
                  className="w-full text-xs p-3 rounded-lg border border-outline-variant bg-surface text-on-surface focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Step 4: Competency Scoring & Feedback */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">fact_check</span>
                    Score Competency Rubric (1–5 Scale)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Preview Score:</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-black">
                      {liveOverallScore} / 100
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${RECOMMENDATION_STYLES[liveRecommendation].badge}`}>
                      {RECOMMENDATION_STYLES[liveRecommendation].label}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {rubricCompetencies.map((comp, cIdx) => (
                    <div key={cIdx} className="p-3.5 rounded-xl border border-outline-variant bg-surface space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-on-surface text-xs">{comp.competency}</span>
                          <span className="text-[11px] text-on-surface-variant ml-2">
                            (Weight: {Math.round(comp.weight * 100)}%)
                          </span>
                        </div>

                        {/* 1-5 Score Buttons */}
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((sVal) => (
                            <button
                              key={sVal}
                              type="button"
                              onClick={() => handleScoreChange(cIdx, sVal)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                comp.score === sVal
                                  ? 'bg-primary text-on-primary shadow-xs scale-105'
                                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                              }`}
                            >
                              {sVal}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Qualitative Feedback */}
                      <input
                        type="text"
                        value={comp.feedback}
                        onChange={(e) => handleFeedbackChange(cIdx, e.target.value)}
                        placeholder="Specific observation or feedback rationale..."
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-outline-variant bg-surface text-on-surface focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Evaluation Result Feedback */}
              {evaluationResult && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="material-symbols-outlined text-base">verified</span>
                    Evaluation Successfully Recorded
                  </div>
                  <p className="text-xs text-on-surface">
                    Candidate achieved overall score: <strong>{evaluationResult.evaluation?.overallScore}/100</strong> ({evaluationResult.evaluation?.recommendation?.replace('_', ' ').toUpperCase()}). Application status is synchronized to <strong>{evaluationResult.applicationStatus}</strong>.
                  </p>
                  {evaluationResult.synthesis?.summary && (
                    <p className="text-xs text-on-surface-variant italic pt-1">
                      "{evaluationResult.synthesis.summary}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-lowest">
              <button
                type="button"
                onClick={() => setShowEvaluateModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleSubmitEvaluation}
                disabled={evaluating || !selectedApplicationId || rubricCompetencies.length === 0}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
              >
                {evaluating ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    Computing & Synthesizing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check</span>
                    Finalize & Submit Evaluation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewIntelligencePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-on-surface-variant">Loading Interview Intelligence...</p>
          </div>
        </div>
      }
    >
      <InterviewIntelligenceContent />
    </React.Suspense>
  );
}
