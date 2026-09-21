'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface PolicySection {
  sectionId: string;
  title: string;
  content: string;
  keywords: string[];
}

interface PolicyDocumentItem {
  _id: string;
  policyCode: string;
  title: string;
  category: string;
  summary: string;
  content?: string;
  version: string;
  status: string;
  effectiveDate: string;
  lastReviewedDate?: string;
  approvedBy?: string;
  sectionsCount: number;
  sections: PolicySection[];
}

interface PolicySourceItem {
  policyCode: string;
  title: string;
  section: string;
  supportingText: string;
}

interface PolicyAnswerResponse {
  question: string;
  answer: string;
  interpretation: string;
  confidence: 'high' | 'medium' | 'low';
  grounded: boolean;
  sources: PolicySourceItem[];
  recommendedNextSteps: string[];
  matchCount: number;
}

export default function PolicyIntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Active Tab: 'qa' | 'library'
  const [activeTab, setActiveTab] = useState<'qa' | 'library'>('qa');

  // Policy QA States
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answerData, setAnswerData] = useState<PolicyAnswerResponse | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Policy Library States
  const [policies, setPolicies] = useState<PolicyDocumentItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected Policy for Inspection Modal/Drawer
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDocumentItem | null>(null);

  // Role Guard: Recruiter & Admin only
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch Policy Library
  const fetchLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    setLibraryError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchFilter.trim()) params.append('search', searchFilter.trim());

      const res = await fetch(`/api/hr/policies?${params.toString()}`, {
        headers: {
          'X-CareerGenie-Role': user?.role || 'recruiter'
        }
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: Recruiter or Administrator role required.');
        }
        throw new Error('Failed to retrieve policy documents.');
      }

      const data = await res.json();
      setPolicies(data.policies || []);
    } catch (err: any) {
      console.error(err);
      setLibraryError(err.message || 'Error fetching policy library.');
    } finally {
      setLoadingLibrary(false);
    }
  }, [categoryFilter, statusFilter, searchFilter, user?.role]);

  useEffect(() => {
    if (user && (user.role === 'recruiter' || user.role === 'admin')) {
      fetchLibrary();
    }
  }, [user, fetchLibrary]);

  // Ask Policy Question
  const handleAskQuestion = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : question).trim();
    if (!q || q.length < 5) {
      setQaError('Please enter a question with at least 5 characters.');
      return;
    }

    setAsking(true);
    setQaError(null);
    setAnswerData(null);

    try {
      const res = await fetch('/api/hr/policy/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CareerGenie-Role': user?.role || 'recruiter'
        },
        body: JSON.stringify({ question: q })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to process policy inquiry.');
      }

      const data = await res.json();
      setAnswerData(data);
    } catch (err: any) {
      console.error(err);
      setQaError(err.message || 'Error querying policy compliance engine.');
    } finally {
      setAsking(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'remote_work':
        return { label: 'Remote & Hybrid', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30', icon: 'laptop_mac' };
      case 'leave_pto':
        return { label: 'Leave & PTO', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', icon: 'event_available' };
      case 'compensation_promotion':
        return { label: 'Compensation & Growth', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', icon: 'trending_up' };
      case 'code_of_conduct':
        return { label: 'Code of Conduct', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', icon: 'gavel' };
      case 'health_benefits':
        return { label: 'Health & Wellness', color: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30', icon: 'health_and_safety' };
      default:
        return { label: category.replace('_', ' '), color: 'bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-500/30', icon: 'article' };
    }
  };

  const suggestedQuestions = [
    'What is the policy on home office equipment and internet stipend?',
    'How many days of paid vacation roll over to the next calendar year?',
    'Can employees work remotely from another country and for how long?',
    'What are the mandatory core collaboration hours for remote workers?',
    'What is the continuous service requirement for four-week sabbatical leave?',
    'Does CareerGenie provide pet insurance or veterinary care for animals?'
  ];

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
            <span className="material-symbols-outlined text-primary text-3xl">policy</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              HR Policy Intelligence & Compliance QA
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              Authoritative Grounding
            </span>
          </div>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Grounded HR policy decision engine. Synthesizes answers strictly from official company policy documents with verifiable source citations.
          </p>
        </div>

        {/* Tab Navigation Switches */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant">
          <button
            onClick={() => setActiveTab('qa')}
            className={`flex items-center gap-2 px-md py-sm rounded-lg font-semibold text-body-sm transition-all ${
              activeTab === 'qa'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg">psychology</span>
            <span>Compliance QA</span>
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-md py-sm rounded-lg font-semibold text-body-sm transition-all ${
              activeTab === 'library'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg">menu_book</span>
            <span>Policy Library ({policies.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COMPLIANCE QA ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'qa' && (
        <div className="space-y-lg">
          {/* Question Input Card */}
          <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant space-y-md shadow-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="policy-qa-input" className="font-title-md text-title-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">search</span>
                Ask an Authoritative HR Policy Question
              </label>
              <span className="text-xs text-on-surface-variant font-mono">
                Source: Active Corporate Policy Documents
              </span>
            </div>

            <div className="relative">
              <textarea
                id="policy-qa-input"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., What is the annual equipment stipend, and what are the core collaboration hours?"
                className="w-full p-4 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-primary transition-all resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAskQuestion();
                  }
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-sm text-green-500">verified</span>
                <span>Deterministic policy retrieval prior to AI synthesis. Zero hallucination guarantee.</span>
              </div>

              <button
                onClick={() => handleAskQuestion()}
                disabled={asking || !question.trim()}
                className="flex items-center justify-center gap-2 px-xl py-sm bg-primary text-on-primary rounded-lg font-bold shadow-sm hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined ${asking ? 'animate-spin' : ''}`}>
                  {asking ? 'sync' : 'auto_awesome'}
                </span>
                <span>{asking ? 'Searching & Grounding...' : 'Ask Policy Engine'}</span>
              </button>
            </div>

            {/* Pre-calibrated Suggestion Chips */}
            <div className="pt-sm border-t border-outline-variant/60">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-2">
                Suggested Policy Queries:
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((sq, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuestion(sq);
                      handleAskQuestion(sq);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border text-left transition-all ${
                      sq.includes('pet relocation')
                        ? 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-500/10'
                        : 'border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* QA Error Notice */}
          {qaError && (
            <div className="p-md rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              <p className="font-body-md text-body-md font-medium">{qaError}</p>
            </div>
          )}

          {/* Grounded QA Result Display */}
          {answerData && (
            <div className="p-lg rounded-xl bg-surface-container-low border border-outline-variant space-y-lg shadow-md animate-fade-in">
              {/* Header & Grounding Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant pb-md">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">
                    User Inquiry
                  </span>
                  <h3 className="font-title-lg text-title-lg font-bold text-on-surface mt-0.5">
                    &ldquo;{answerData.question}&rdquo;
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  {answerData.grounded ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      Grounded in Policy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      Policy Coverage Not Found
                    </span>
                  )}

                  <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant font-semibold">
                    Confidence: {answerData.confidence.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Section 1: WHAT THE POLICY SAYS */}
              <div className="p-md rounded-xl bg-surface border border-outline-variant space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider font-mono">
                  <span className="material-symbols-outlined text-base">menu_book</span>
                  WHAT THE POLICY EXPLICITLY SAYS
                </div>
                <p className="text-on-surface font-body-lg text-body-lg leading-relaxed font-medium whitespace-pre-line">
                  {answerData.answer}
                </p>
              </div>

              {/* Section 2: WHY IT APPLIES & INTERPRETATION */}
              <div className="p-md rounded-xl bg-surface border border-outline-variant space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider font-mono">
                  <span className="material-symbols-outlined text-base">lightbulb</span>
                  OPERATIONAL CONTEXT & INTERPRETATION
                </div>
                <p className="text-on-surface-variant font-body-md text-body-md leading-relaxed">
                  {answerData.interpretation}
                </p>
              </div>

              {/* Section 3: OFFICIAL POLICY SOURCES */}
              <div className="space-y-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider font-mono">
                    <span className="material-symbols-outlined text-base">library_books</span>
                    OFFICIAL POLICY CITATIONS ({answerData.sources.length})
                  </div>
                  <span className="text-xs text-on-surface-variant font-mono">
                    Ground Truth Reference
                  </span>
                </div>

                {answerData.sources.length === 0 ? (
                  <div className="p-md rounded-xl bg-surface border border-outline-variant text-body-sm text-on-surface-variant text-center">
                    No relevant policy documents match this inquiry in the current compliance index.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                    {answerData.sources.map((src, idx) => (
                      <div
                        key={idx}
                        className="p-md rounded-xl bg-surface border border-outline-variant space-y-2 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {src.policyCode}
                          </span>
                          <span className="text-xs font-semibold text-on-surface-variant">
                            {src.title}
                          </span>
                        </div>
                        <div className="font-semibold text-body-sm text-on-surface">
                          {src.section}
                        </div>
                        <blockquote className="text-xs text-on-surface-variant bg-surface-container-low p-2 rounded-lg border-l-2 border-primary font-mono italic leading-relaxed">
                          &ldquo;{src.supportingText}&rdquo;
                        </blockquote>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: RECOMMENDED NEXT STEPS */}
              {answerData.recommendedNextSteps && answerData.recommendedNextSteps.length > 0 && (
                <div className="p-md rounded-xl bg-surface border border-outline-variant space-y-sm">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
                    <span className="material-symbols-outlined text-base">checklist</span>
                    RECOMMENDED COMPLIANCE NEXT STEPS
                  </div>
                  <ul className="space-y-2">
                    {answerData.recommendedNextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-body-sm text-on-surface">
                        <span className="material-symbols-outlined text-base text-emerald-500 mt-0.5">
                          arrow_right_alt
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HR POLICY LIBRARY */}
      {/* ========================================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-lg">
          {/* Filter & Search Toolbar */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant flex flex-col md:flex-row gap-md items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-xl">
                search
              </span>
              <input
                type="text"
                placeholder="Search policies by title, code, or keyword..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-medium focus:outline-none focus:border-primary"
              >
                <option value="all">All Categories</option>
                <option value="remote_work">Remote & Hybrid</option>
                <option value="leave_pto">Leave & PTO</option>
                <option value="compensation_promotion">Compensation & Promotion</option>
                <option value="code_of_conduct">Code of Conduct</option>
                <option value="health_benefits">Health & Wellness</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm font-medium focus:outline-none focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>

              {(categoryFilter !== 'all' || statusFilter !== 'all' || searchFilter) && (
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setSearchFilter('');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Error Notice */}
          {libraryError && (
            <div className="p-md rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              <p className="font-body-md text-body-md font-medium">{libraryError}</p>
            </div>
          )}

          {/* Policies Grid */}
          {loadingLibrary ? (
            <div className="flex flex-col items-center justify-center p-xl">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary mb-3"></div>
              <p className="font-body-md text-on-surface-variant">Loading corporate policies...</p>
            </div>
          ) : policies.length === 0 ? (
            <div className="p-xl text-center space-y-2 rounded-xl bg-surface-container-low border border-outline-variant">
              <span className="material-symbols-outlined text-on-surface-variant text-5xl">folder_off</span>
              <h3 className="font-title-md text-title-md font-bold text-on-surface">
                No Policies Found
              </h3>
              <p className="text-on-surface-variant font-body-sm max-w-md mx-auto">
                No policy documents match the selected filters or search terms.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {policies.map((doc) => {
                const catBadge = getCategoryBadge(doc.category);
                return (
                  <div
                    key={doc._id}
                    onClick={() => setSelectedPolicy(doc)}
                    className="p-lg rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary/50 transition-all cursor-pointer space-y-md shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-surface border border-outline-variant text-primary">
                            {doc.policyCode}
                          </span>
                          <span className="text-xs text-on-surface-variant font-mono">
                            v{doc.version}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${catBadge.color}`}
                          >
                            {catBadge.label}
                          </span>
                        </div>
                        <h3 className="font-title-md text-title-md font-bold text-on-surface group-hover:text-primary transition-colors">
                          {doc.title}
                        </h3>
                      </div>

                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                        chevron_right
                      </span>
                    </div>

                    <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                      {doc.summary}
                    </p>

                    <div className="pt-sm border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant font-mono">
                      <span>Effective: {doc.effectiveDate}</span>
                      <span className="font-semibold text-primary">
                        {doc.sectionsCount || (doc.sections || []).length} Sections
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* POLICY DOCUMENT DETAIL INSPECTION MODAL */}
      {/* ========================================================================= */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-on-background/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-surface rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up border border-outline-variant">
            {/* Modal Header */}
            <div className="p-lg border-b border-outline-variant flex items-start justify-between bg-surface-container-low">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {selectedPolicy.policyCode}
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    Version {selectedPolicy.version}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-500/15 text-green-700 dark:text-green-300">
                    {selectedPolicy.status}
                  </span>
                </div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {selectedPolicy.title}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Effective Date: {selectedPolicy.effectiveDate}
                  {selectedPolicy.approvedBy && ` • Approved by: ${selectedPolicy.approvedBy}`}
                </p>
              </div>

              <button
                onClick={() => setSelectedPolicy(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-lg space-y-lg">
              {/* Summary */}
              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
                  Executive Summary
                </span>
                <p className="text-body-md text-on-surface leading-relaxed">
                  {selectedPolicy.summary}
                </p>
              </div>

              {/* Sections Breakdown */}
              <div className="space-y-md">
                <h4 className="font-title-md text-title-md font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
                  Policy Clauses & Sections ({(selectedPolicy.sections || []).length})
                </h4>

                <div className="space-y-md">
                  {(selectedPolicy.sections || []).map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-md rounded-xl bg-surface border border-outline-variant space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface">
                          {sec.sectionId}
                        </span>
                        <h5 className="font-bold text-body-md text-on-surface flex-1 ml-3">
                          {sec.title}
                        </h5>
                      </div>

                      <p className="text-body-sm text-on-surface-variant leading-relaxed pl-1">
                        {sec.content}
                      </p>

                      {sec.keywords && sec.keywords.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1">
                          {sec.keywords.map((kw, kIdx) => (
                            <span
                              key={kIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant/50"
                            >
                              #{kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-md border-t border-outline-variant bg-surface-container flex items-center justify-between">
              <button
                onClick={() => {
                  setQuestion(`What does ${selectedPolicy.policyCode} say about `);
                  setActiveTab('qa');
                  setSelectedPolicy(null);
                }}
                className="px-md py-sm bg-primary/10 text-primary font-bold text-xs rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">psychology</span>
                <span>Ask Question About This Policy</span>
              </button>

              <button
                onClick={() => setSelectedPolicy(null)}
                className="px-md py-sm bg-surface-container-high text-on-surface font-semibold text-xs rounded-lg hover:bg-outline-variant transition-colors"
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
