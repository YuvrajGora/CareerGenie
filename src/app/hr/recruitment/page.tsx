'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================

interface JobOption {
  _id: string;
  title: string;
  company: string;
  location: string;
  experience: number;
  requiredSkills: string[];
  candidateCount: number;
  createdAt: string;
}

interface CandidateItem {
  candidateId: string;
  name: string;
  email: string;
  careerLevel: string;
  yearsOfExperience: number;
  education: string;
  profileImage?: string;
  applicationId?: string;
  applicationStatus: 'applied' | 'interviewing' | 'accepted' | 'rejected' | 'pool';
  appliedAt?: string;
  matchScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
  hasInterviewEvaluation: boolean;
  interviewRecommendation?: 'strong_hire' | 'hire' | 'borderline' | 'do_not_hire';
}

interface SummaryKPIs {
  totalCandidates: number;
  strongMatches: number;
  inInterview: number;
  averageMatchScore: number;
}

interface MatchExplanationData {
  explanation: {
    verdict: 'strong_match' | 'qualified_match' | 'borderline' | 'not_recommended';
    executiveSummary: string;
    keyStrengths: string[];
    identifiedGaps: string[];
    experienceAssessment: string;
    recommendedInterviewFocus: string[];
  };
  scores: {
    matchScore: number;
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  candidate: {
    _id: string;
    name: string;
    email: string;
    careerLevel: string;
    yearsOfExperience: number;
    education: string;
  };
  job: {
    _id: string;
    title: string;
    company: string;
    requiredSkills: string[];
    experience: number;
  };
}

export default function RecruitmentIntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // State
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [summary, setSummary] = useState<SummaryKPIs | null>(null);
  const [currentJob, setCurrentJob] = useState<any>(null);

  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('matchScore');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Explanation Modal / Drawer
  const [explainingCandidate, setExplainingCandidate] = useState<CandidateItem | null>(null);
  const [explanationData, setExplanationData] = useState<MatchExplanationData | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  // Redirect unauthorized
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    } else if (user && user.role === 'student') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // 1. Fetch available jobs for selector
  const fetchJobs = useCallback(async () => {
    try {
      setLoadingJobs(true);
      setErrorMsg(null);

      const res = await fetch('/api/hr/recruitment/jobs');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load recruitment jobs.');
      }

      const data = await res.json();
      const jobList: JobOption[] = data.jobs || [];
      setJobs(jobList);

      if (jobList.length > 0 && !selectedJobId) {
        setSelectedJobId(jobList[0]._id);
      }
    } catch (err: any) {
      console.error('Error fetching recruitment jobs:', err);
      setErrorMsg(err.message || 'Failed to load recruitment jobs.');
    } finally {
      setLoadingJobs(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (user && user.role !== 'student') {
      fetchJobs();
    }
  }, [fetchJobs, user]);

  // 2. Fetch ranked candidates when selected job or filters change
  const fetchCandidates = useCallback(async () => {
    if (!selectedJobId) return;

    try {
      setLoadingCandidates(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.append('jobId', selectedJobId);

      if (minScoreFilter !== 'all') {
        params.append('minScore', minScoreFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }

      const res = await fetch(`/api/hr/recruitment/candidates?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load candidate rankings.');
      }

      const data = await res.json();
      setCandidates(data.candidates || []);
      setSummary(data.summary || null);
      setCurrentJob(data.job || null);
    } catch (err: any) {
      console.error('Error fetching ranked candidates:', err);
      setErrorMsg(err.message || 'Failed to load candidate rankings.');
    } finally {
      setLoadingCandidates(false);
    }
  }, [selectedJobId, minScoreFilter, statusFilter, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    if (selectedJobId && user && user.role !== 'student') {
      fetchCandidates();
    }
  }, [fetchCandidates, selectedJobId, user]);

  // 3. Trigger CSV Shortlist Export
  const handleExportCsv = () => {
    if (!selectedJobId) return;

    const params = new URLSearchParams();
    params.append('jobId', selectedJobId);
    if (minScoreFilter !== 'all') params.append('minScore', minScoreFilter);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);

    window.open(`/api/hr/recruitment/export?${params.toString()}`, '_blank');
  };

  // 4. Fetch Explanation for Modal
  const openExplainModal = async (cand: CandidateItem) => {
    setExplainingCandidate(cand);
    setExplanationData(null);
    setExplanationError(null);
    setLoadingExplanation(true);

    try {
      const res = await fetch(`/api/hr/recruitment/explain?jobId=${selectedJobId}&candidateId=${cand.candidateId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate match explanation.');
      }
      const data = await res.json();
      setExplanationData(data);
    } catch (err: any) {
      console.error('Error fetching match explanation:', err);
      setExplanationError(err.message || 'Failed to generate match explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  const closeExplainModal = () => {
    setExplainingCandidate(null);
    setExplanationData(null);
    setExplanationError(null);
  };

  // 5. Navigate to Interview Agent
  const handleInterviewCandidate = (cand: CandidateItem) => {
    if (cand.applicationId) {
      router.push(`/hr/interviews?applicationId=${cand.applicationId}`);
    } else {
      router.push(`/hr/interviews`);
    }
  };

  // Status Badge formatting helper
  const getStatusBadge = (status: CandidateItem['applicationStatus']) => {
    switch (status) {
      case 'interviewing':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200">Interviewing</span>;
      case 'accepted':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200">Accepted</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200">Rejected</span>;
      case 'applied':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200">Applied</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300">Candidate Pool</span>;
    }
  };

  // Score Badge formatting helper
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300';
    if (score >= 70) return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300';
    if (score >= 50) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300';
    return 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300';
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'strong_match':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500 text-white shadow-sm">Strong Match</span>;
      case 'qualified_match':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500 text-white shadow-sm">Qualified Match</span>;
      case 'borderline':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 text-white shadow-sm">Borderline Alignment</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500 text-white shadow-sm">Not Recommended</span>;
    }
  };

  if (authLoading || loadingJobs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || user.role === 'student') return null;

  return (
    <div className="mt-20 px-4 md:px-8 pb-16 min-h-screen max-w-7xl mx-auto text-left">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">Recruitment Intelligence</h1>
            <span className="px-2.5 py-0.5 text-xs font-black uppercase rounded bg-primary/10 text-primary border border-primary/20">
              RedRankAI
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1 font-medium">
            AI-assisted candidate discovery, deterministic multi-signal ranking, and grounded decision support.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Job Selector Dropdown */}
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant">
            <span className="material-symbols-outlined text-outline text-lg">work</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-on-surface focus:outline-none cursor-pointer pr-4"
              disabled={jobs.length === 0}
            >
              {jobs.length === 0 ? (
                <option value="">No Active Postings Found</option>
              ) : (
                jobs.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.title} ({j.candidateCount} applicants)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => { fetchJobs(); fetchCandidates(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-sm font-semibold border border-outline-variant transition-colors"
            title="Refresh Candidate Rankings"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={!selectedJobId || candidates.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
            title="Download CSV Shortlist"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/30 text-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">error</span>
            <span className="text-sm font-bold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* 2. KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
            <div className="flex items-center justify-between text-on-surface-variant mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Total Candidates</span>
              <span className="material-symbols-outlined text-lg text-primary">groups</span>
            </div>
            <div className="text-2xl font-black text-on-surface">{summary.totalCandidates}</div>
            <span className="text-[11px] text-outline font-medium">Discovered in pool & pipeline</span>
          </div>

          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
            <div className="flex items-center justify-between text-on-surface-variant mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Strong Matches</span>
              <span className="material-symbols-outlined text-lg text-emerald-600">verified</span>
            </div>
            <div className="text-2xl font-black text-emerald-600">{summary.strongMatches}</div>
            <span className="text-[11px] text-outline font-medium">Score &ge; 80% multi-signal alignment</span>
          </div>

          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
            <div className="flex items-center justify-between text-on-surface-variant mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">In Interview</span>
              <span className="material-symbols-outlined text-lg text-blue-600">psychology</span>
            </div>
            <div className="text-2xl font-black text-blue-600">{summary.inInterview}</div>
            <span className="text-[11px] text-outline font-medium">Active interview evaluations</span>
          </div>

          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
            <div className="flex items-center justify-between text-on-surface-variant mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Avg Match Score</span>
              <span className="material-symbols-outlined text-lg text-primary">trending_up</span>
            </div>
            <div className="text-2xl font-black text-on-surface">{summary.averageMatchScore}%</div>
            <span className="text-[11px] text-outline font-medium">Across active candidate pool</span>
          </div>
        </div>
      )}

      {/* 3. Multi-Signal Filtering Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant flex-1 min-w-[220px]">
          <span className="material-symbols-outlined text-outline text-lg">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate name, email, or skill..."
            className="bg-transparent border-none text-sm font-medium w-full outline-none pl-2 text-on-surface"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Min Score Filter */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
            <span>Score:</span>
            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none"
            >
              <option value="all">All Scores</option>
              <option value="85">85%+ (Top Tier)</option>
              <option value="80">80%+ (Strong)</option>
              <option value="70">70%+ (Qualified)</option>
              <option value="50">50%+ (Baseline)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none"
            >
              <option value="all">All Stages</option>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="pool">Candidate Pool</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none"
            >
              <option value="matchScore">Overall Score</option>
              <option value="skillsMatch">Skills Match</option>
              <option value="experienceMatch">Experience Match</option>
              <option value="appliedAt">Applied Date</option>
            </select>
          </div>

          {/* Order Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="p-1.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-lg text-on-surface transition-colors"
            title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Ranked Candidates Table / Cockpit */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        {loadingCandidates ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
            <span className="text-sm font-bold text-on-surface-variant">Calculating candidate rankings & multi-signal alignment...</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-20 text-center px-4">
            <span className="material-symbols-outlined text-5xl text-outline mb-2">person_search</span>
            <h3 className="text-base font-bold text-on-surface">No Candidates Found</h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
              No candidates matching your current filter criteria were found for this job posting. Try relaxing the score or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/70 border-b border-outline-variant text-[11px] font-black uppercase text-on-surface-variant tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4 text-center">Overall Match</th>
                  <th className="py-3 px-4">Deterministic Breakdown</th>
                  <th className="py-3 px-4">Skill Alignment</th>
                  <th className="py-3 px-4 text-center">Stage & Verdict</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {candidates.map((cand, index) => (
                  <tr key={cand.candidateId} className="hover:bg-surface-container-low/40 transition-colors">
                    {/* Rank Badge */}
                    <td className="py-4 px-4 text-center font-black">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                        index === 0 ? 'bg-amber-400/20 text-amber-600 border border-amber-400' :
                        index === 1 ? 'bg-slate-300/30 text-slate-700 border border-slate-300' :
                        index === 2 ? 'bg-amber-700/15 text-amber-700 border border-amber-600' :
                        'bg-surface-container text-on-surface-variant'
                      }`}>
                        #{index + 1}
                      </span>
                    </td>

                    {/* Candidate Identity */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-on-surface">{cand.name}</div>
                      <div className="text-xs text-outline">{cand.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                          {cand.careerLevel}
                        </span>
                        <span className="text-[11px] text-outline font-medium">
                          {cand.yearsOfExperience} yrs exp
                        </span>
                      </div>
                    </td>

                    {/* Overall Match Score */}
                    <td className="py-4 px-4 text-center">
                      <div className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-lg font-black border ${getScoreColor(cand.matchScore)}`}>
                        {cand.matchScore}%
                      </div>
                    </td>

                    {/* Multi-Signal Breakdown */}
                    <td className="py-4 px-4 min-w-[200px]">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-on-surface-variant font-medium">Skills (60%):</span>
                          <span className="font-bold text-on-surface">{cand.skillsMatch}%</span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${cand.skillsMatch}%` }}></div>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-on-surface-variant font-medium">Experience (20%):</span>
                          <span className="font-bold text-on-surface">{cand.experienceMatch}%</span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary/70 h-full rounded-full" style={{ width: `${cand.experienceMatch}%` }}></div>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-on-surface-variant font-medium">Education (10%):</span>
                          <span className="font-bold text-on-surface">{cand.educationMatch}%</span>
                        </div>
                      </div>
                    </td>

                    {/* Skill Alignment Chips */}
                    <td className="py-4 px-4 max-w-[240px]">
                      <div className="flex flex-wrap gap-1">
                        {cand.matchedSkills.slice(0, 3).map((skill, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                            {skill}
                          </span>
                        ))}
                        {cand.missingSkills.slice(0, 2).map((skill, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 line-through opacity-75">
                            {skill}
                          </span>
                        ))}
                        {cand.matchedSkills.length + cand.missingSkills.length > 5 && (
                          <span className="text-[10px] text-outline font-semibold">
                            +{cand.matchedSkills.length + cand.missingSkills.length - 5} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stage & Recommendation */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {getStatusBadge(cand.applicationStatus)}
                        {cand.interviewRecommendation && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Rec: {cand.interviewRecommendation.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Explain Button */}
                        <button
                          onClick={() => openExplainModal(cand)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                          title="View Deterministic Score Audit & Gemini Evidence Explanation"
                        >
                          <span className="material-symbols-outlined text-[15px]">psychology_alt</span>
                          Explain
                        </button>

                        {/* Interview Candidate Button */}
                        <button
                          onClick={() => handleInterviewCandidate(cand)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:brightness-110 shadow-sm transition-all"
                          title="Evaluate Candidate in Interview Agent"
                        >
                          <span className="material-symbols-outlined text-[15px]">record_voice_over</span>
                          Interview
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Match Explanation Slide-Over / Modal */}
      {explainingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">psychology_alt</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">
                    Recruitment Intelligence Audit: {explainingCandidate.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Evidence-grounded rationale for {currentJob?.title || 'Target Job'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeExplainModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {loadingExplanation ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
                  <span className="text-sm font-bold text-on-surface-variant">Generating evidence-grounded AI synthesis...</span>
                </div>
              ) : explanationError ? (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-bold">
                  {explanationError}
                </div>
              ) : explanationData ? (
                <>
                  {/* Deterministic Score Audit Card */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-on-surface-variant tracking-wider">
                        Deterministic 60-20-10-10 Multi-Signal Audit
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Authoritative Mathematical Score
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-3xl font-black text-primary">
                        {explanationData.scores.matchScore}%
                      </span>
                      {getVerdictBadge(explanationData.explanation.verdict)}
                    </div>

                    {/* Score Formula Components */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/50 text-xs">
                      <div className="p-2 rounded bg-surface-container">
                        <div className="text-[10px] text-outline font-semibold uppercase">Skills (60%)</div>
                        <div className="text-sm font-bold text-on-surface">{explanationData.scores.skillsMatch}%</div>
                      </div>
                      <div className="p-2 rounded bg-surface-container">
                        <div className="text-[10px] text-outline font-semibold uppercase">Experience (20%)</div>
                        <div className="text-sm font-bold text-on-surface">{explanationData.scores.experienceMatch}%</div>
                      </div>
                      <div className="p-2 rounded bg-surface-container">
                        <div className="text-[10px] text-outline font-semibold uppercase">Education (10%)</div>
                        <div className="text-sm font-bold text-on-surface">{explanationData.scores.educationMatch}%</div>
                      </div>
                    </div>

                    <p className="text-[10px] text-outline font-medium italic">
                      *Note: The overall match score is mathematically calculated and authoritative. Gemini does not assign or modify numeric scores.
                    </p>
                  </div>

                  {/* Skill Alignment */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
                      Skill Alignment Breakdown
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          Matched Competencies ({explanationData.matchedSkills.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {explanationData.matchedSkills.length === 0 ? (
                            <span className="text-xs text-outline italic">No direct keyword overlap</span>
                          ) : (
                            explanationData.matchedSkills.map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                {s}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                        <div className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">cancel</span>
                          Missing Requirements ({explanationData.missingSkills.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {explanationData.missingSkills.length === 0 ? (
                            <span className="text-xs text-outline italic">All requirements matched</span>
                          ) : (
                            explanationData.missingSkills.map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-xs font-bold rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                                {s}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gemini Interpretive Narrative */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
                      AI Evidence Synthesis (Gemini 2.5 Flash)
                    </h4>

                    {/* Executive Summary */}
                    <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/60 text-sm leading-relaxed text-on-surface">
                      <p className="font-semibold">{explanationData.explanation.executiveSummary}</p>
                    </div>

                    {/* Key Strengths & Gaps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant space-y-1.5">
                        <div className="font-bold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-emerald-600 text-[16px]">thumb_up</span>
                          Key Profile Strengths
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-on-surface-variant font-medium">
                          {explanationData.explanation.keyStrengths.map((st, sIdx) => (
                            <li key={sIdx}>{st}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant space-y-1.5">
                        <div className="font-bold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-amber-600 text-[16px]">warning</span>
                          Identified Shortfalls / Gaps
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-on-surface-variant font-medium">
                          {explanationData.explanation.identifiedGaps.map((gp, gIdx) => (
                            <li key={gIdx}>{gp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Experience Assessment */}
                    <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant text-xs space-y-1">
                      <div className="font-bold text-on-surface">Experience & Seniority Assessment</div>
                      <p className="text-on-surface-variant font-medium leading-relaxed">
                        {explanationData.explanation.experienceAssessment}
                      </p>
                    </div>

                    {/* Recommended Interview Focus */}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1.5">
                      <div className="font-bold text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">psychology</span>
                        Recommended Interview Probes
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-on-surface font-medium">
                        {explanationData.explanation.recommendedInterviewFocus.map((foc, fIdx) => (
                          <li key={fIdx}>{foc}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
              <button
                onClick={closeExplainModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => {
                  closeExplainModal();
                  handleInterviewCandidate(explainingCandidate);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:brightness-110 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
                Evaluate in Interview Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
