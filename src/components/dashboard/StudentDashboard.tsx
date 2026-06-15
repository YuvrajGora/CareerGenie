'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Job {
  _id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  requiredSkills: string[];
  salaryRange?: string;
  logoUrl?: string;
  matchScore?: number;
}

interface DashboardData {
  metrics: {
    resumeScore: number | string;
    resumeTrend: string;
    jobsMatched: number;
    jobMatchTrend: string;
    applicationsCount: number;
    pendingApps: number;
    rejectedApps: number;
    appGrowthTrend: string;
    interviewChances: string;
    interviewSubtext: string;
  };
  activities: Array<{
    _id: string;
    type: string;
    description: string;
    timestampLabel: string;
  }>;
  recommendations: {
    title: string;
    text: string;
    skills: string[];
  };
  marketInsights: Array<{
    title: string;
    badge?: string;
    text: string;
  }>;
  jobs: Job[];
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-xl">
      {/* Bento Grid Stats Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl h-36 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="w-10 h-10 bg-surface-container rounded-lg"></div>
              <div className="w-12 h-4 bg-surface-container rounded"></div>
            </div>
            <div className="w-24 h-4 bg-surface-container rounded mt-sm"></div>
            <div className="w-16 h-8 bg-surface-container rounded"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
        {/* Left Column Skeletons */}
        <div className="lg:col-span-8 space-y-xl">
          {/* AI Insights Banner Skeleton */}
          <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl h-56 flex flex-col justify-between">
            <div className="space-y-sm">
              <div className="w-32 h-5 bg-surface-container rounded"></div>
              <div className="w-3/4 h-8 bg-surface-container rounded"></div>
              <div className="w-1/2 h-4 bg-surface-container rounded"></div>
            </div>
            <div className="flex gap-md mt-lg">
              <div className="w-28 h-10 bg-surface-container rounded-lg"></div>
              <div className="w-28 h-10 bg-surface-container rounded-lg"></div>
            </div>
          </div>

          {/* Hub Skeletons */}
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl h-48 flex flex-col justify-between">
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 bg-surface-container rounded-lg"></div>
                <div className="space-y-sm flex-1">
                  <div className="w-1/3 h-6 bg-surface-container rounded"></div>
                  <div className="w-1/2 h-4 bg-surface-container rounded"></div>
                </div>
              </div>
              <div className="w-full h-12 bg-surface-container rounded-lg mt-md"></div>
            </div>
          ))}
        </div>

        {/* Sidebar Column Skeletons */}
        <div className="lg:col-span-4 space-y-xl">
          <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl h-96 flex flex-col justify-between">
            <div className="w-1/2 h-6 bg-surface-container rounded mb-lg"></div>
            <div className="space-y-md flex-1">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex gap-md">
                  <div className="w-6 h-6 bg-surface-container rounded-full shrink-0"></div>
                  <div className="space-y-sm flex-1">
                    <div className="w-1/2 h-4 bg-surface-container rounded"></div>
                    <div className="w-full h-3 bg-surface-container rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // AI Interview Prep State Variables
  const [selectedJobForPrep, setSelectedJobForPrep] = useState<Job | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepData, setPrepData] = useState<any | null>(null);
  const [activePrepTab, setActivePrepTab] = useState<'technical' | 'behavioral' | 'weaknesses'>('technical');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null);

  // AI Cover Letter State Variables
  const [selectedJobForCoverLetter, setSelectedJobForCoverLetter] = useState<Job | null>(null);
  const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'enthusiastic' | 'concise'>('professional');
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterData, setCoverLetterData] = useState<any | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Error loading student dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleQuickApply = async (jobId: string) => {
    setApplyingId(jobId);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) {
        alert('Application submitted successfully!');
        fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to submit application.');
      }
    } catch (err) {
      alert('Error connecting to the backend. Please try again.');
    } finally {
      setApplyingId(null);
    }
  };

  const handleGeneratePrep = async (jobId: string, forceRefresh = false) => {
    setPrepLoading(true);
    setExpandedQuestionIndex(null);
    try {
      const res = await fetch('/api/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, refresh: forceRefresh }),
      });
      if (res.ok) {
        const data = await res.json();
        setPrepData(data.interviewPrep);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to retrieve interview prep questions.');
      }
    } catch (err) {
      alert('Error fetching interview prep data.');
    } finally {
      setPrepLoading(false);
    }
  };

  const handlePrepareInterviewClick = (job: Job) => {
    setSelectedJobForPrep(job);
    handleGeneratePrep(job._id);
    setTimeout(() => {
      document.getElementById('interview-prep-hub')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // AI Cover Letter Generator Handlers
  const handleGenerateCoverLetter = async (jobId: string, tone: 'professional' | 'enthusiastic' | 'concise', forceRefresh = false) => {
    setCoverLetterLoading(true);
    setCopyFeedback(false);
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, tone, refresh: forceRefresh }),
      });
      if (res.ok) {
        const data = await res.json();
        setCoverLetterData(data.coverLetter);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to retrieve or generate cover letter.');
      }
    } catch (err) {
      alert('Error fetching cover letter.');
    } finally {
      setCoverLetterLoading(false);
    }
  };

  const handleToneChange = (tone: 'professional' | 'enthusiastic' | 'concise') => {
    setCoverLetterTone(tone);
    if (selectedJobForCoverLetter) {
      handleGenerateCoverLetter(selectedJobForCoverLetter._id, tone);
    }
  };

  const handlePrepareCoverLetterClick = (job: Job) => {
    setSelectedJobForCoverLetter(job);
    setCoverLetterData(null);
    handleGenerateCoverLetter(job._id, coverLetterTone);
    setTimeout(() => {
      document.getElementById('cover-letter-hub')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCopyCoverLetter = () => {
    if (!coverLetterData?.content) return;
    navigator.clipboard.writeText(coverLetterData.content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownloadCoverLetter = () => {
    if (!coverLetterData?.content) return;
    const blob = new Blob([coverLetterData.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cover_Letter_${selectedJobForCoverLetter?.company.replace(/\s+/g, '_')}_${selectedJobForCoverLetter?.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const metrics = dashboardData?.metrics;
  const activities = dashboardData?.activities || [];
  const recommendations = dashboardData?.recommendations;
  const marketInsights = dashboardData?.marketInsights || [];
  const jobs = dashboardData?.jobs || [];

  return (
    <div className="pt-24 px-lg pb-xl max-w-max-width mx-auto">
      {loading ? (
        <>
          {/* Welcome Header Skeleton */}
          <div className="mb-xl flex flex-col md:flex-row md:items-center justify-between gap-md animate-pulse">
            <div className="space-y-sm">
              <div className="w-64 h-8 bg-surface-container rounded"></div>
              <div className="w-80 h-4 bg-surface-container rounded mt-1"></div>
            </div>
            <div className="w-36 h-10 bg-surface-container rounded-lg"></div>
          </div>
          <DashboardSkeleton />
        </>
      ) : (
        <>
          {/* Welcome Header */}
          <div className="mb-xl flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-black">Welcome back, {user?.name}!</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Your profile is active. You matched with {metrics?.jobsMatched || 0} new companies recently.
              </p>
            </div>
            <Link href="/resume" className="px-lg py-sm bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:brightness-110 transition-all text-center">
              Upload New Resume
            </Link>
          </div>

          {/* Bento Grid Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">description</span>
                <span className="text-primary font-label-sm text-label-sm font-semibold">{metrics?.resumeTrend || '+0%'}</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Resume Score</p>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-bold text-on-surface">
                  {metrics?.resumeScore !== undefined ? metrics.resumeScore : 'N/A'}
                </span>
                <span className="text-on-surface-variant font-body-sm pb-1">/100</span>
              </div>
              <div className="w-full bg-surface-variant h-1.5 rounded-full mt-md">
                <div
                  className="bg-primary h-full rounded-full animate-pulse"
                  style={{ width: `${typeof metrics?.resumeScore === 'number' ? metrics.resumeScore : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">auto_awesome</span>
                <span className="text-primary font-label-sm text-label-sm font-semibold">{metrics?.jobMatchTrend || '+0%'}</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Jobs Matched</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{metrics?.jobsMatched || 0}</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-md">Based on your interests</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">send</span>
                <span className="text-primary font-label-sm text-label-sm font-semibold">{metrics?.appGrowthTrend || '+0 this week'}</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Applications Sent</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{metrics?.applicationsCount || 0}</p>
              <div className="flex gap-2 mt-md">
                <span className="px-2 py-0.5 bg-surface-container rounded text-label-sm font-medium">{metrics?.pendingApps || 0} Pending</span>
                <span className="px-2 py-0.5 bg-surface-container rounded text-label-sm font-medium">{metrics?.rejectedApps || 0} Rejected</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">trending_up</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Interview Chances</p>
              <p className="text-3xl font-bold text-primary mt-1">{metrics?.interviewChances || 'N/A'}</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-md">{metrics?.interviewSubtext || 'Upload resume to calculate'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
            {/* AI Insights & Job Recommendations */}
            <div className="lg:col-span-8 space-y-xl">
              {/* AI Insights Widget */}
              <div className="relative overflow-hidden bg-primary text-white p-xl rounded-2xl shadow-lg border border-primary">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>psychology</span>
                </div>
                <div className="relative z-10 text-left">
                  <div className="flex items-center gap-2 mb-md">
                    <span className="material-symbols-outlined animate-bounce">bolt</span>
                    <span className="font-label-md text-label-md uppercase tracking-wider font-bold">AI Optimization Insight</span>
                  </div>
                  <h3 className="font-headline-lg text-headline-lg mb-sm font-bold">{recommendations?.title || 'Boost your employability'}</h3>
                  <p className="font-body-lg text-body-lg opacity-90 max-w-lg">
                    {recommendations?.text || 'Add high-demand skills to your profile to stand out to employers.'}
                  </p>
                  <div className="mt-xl flex gap-md">
                    <Link href="/resume" className="bg-white text-primary px-xl py-md rounded-lg font-label-md text-label-md font-bold hover:bg-opacity-95 transition-all text-center">
                      Update Resume
                    </Link>
                    <Link href="/profile" className="border border-white/30 text-white px-xl py-md rounded-lg font-label-md text-label-md font-bold hover:bg-white/10 transition-all text-center">
                      Edit Profile
                    </Link>
                  </div>
                </div>
              </div>

              {/* AI Interview Prep Hub */}
              <div id="interview-prep-hub" className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">forum</span>
                      <h3 className="font-headline-md text-headline-md text-on-surface font-bold">AI Interview Prep Hub</h3>
                    </div>
                    <p className="text-on-surface-variant font-body-sm">
                      {selectedJobForPrep
                        ? `Preparing for ${selectedJobForPrep.title} at ${selectedJobForPrep.company}`
                        : "Select a job to generate tailored technical and behavioral practice questions."}
                    </p>
                  </div>
                  {selectedJobForPrep && prepData && (
                    <div className="flex gap-sm">
                      <button
                        onClick={() => {
                          setSelectedJobForPrep(null);
                          setPrepData(null);
                        }}
                        className="px-md py-sm border border-outline text-on-surface font-label-sm text-label-sm rounded-lg hover:bg-surface-container transition-all"
                      >
                        Change Job
                      </button>
                      <button
                        onClick={() => handleGeneratePrep(selectedJobForPrep._id, true)}
                        disabled={prepLoading}
                        className="px-md py-sm bg-secondary text-white font-label-sm text-label-sm rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        {prepLoading ? 'Regenerating...' : 'Refresh Prep'}
                      </button>
                    </div>
                  )}
                </div>

                {prepLoading ? (
                  <div className="flex flex-col items-center py-xl gap-md text-center">
                    <span className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></span>
                    <div>
                      <p className="font-label-md text-label-md text-on-surface font-bold">Generating Personalized Practice Questions...</p>
                      <p className="font-body-sm text-on-surface-variant max-w-sm mt-1">
                        Gemini is analyzing your resume, ATS feedback, and the job requirements to tailor questions for you.
                      </p>
                    </div>
                  </div>
                ) : !selectedJobForPrep ? (
                  <div className="py-md">
                    <div className="flex flex-col sm:flex-row gap-md items-end">
                      <div className="flex-1">
                        <label className="block text-on-surface-variant font-label-sm text-label-sm font-semibold mb-sm">Select Target Position</label>
                        <select
                          onChange={(e) => {
                            const job = jobs.find(j => j._id === e.target.value);
                            if (job) {
                              setSelectedJobForPrep(job);
                              handleGeneratePrep(job._id);
                            }
                          }}
                          value=""
                          className="w-full px-md py-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface font-body-md"
                        >
                          <option value="" disabled>-- Select a job to practice --</option>
                          {jobs.map((job) => (
                            <option key={job._id} value={job._id}>
                              {job.title} at {job.company} ({job.matchScore ? `${job.matchScore}% Match` : 'Matches'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : prepData ? (
                  <div>
                    {/* Category Tabs */}
                    <div className="flex border-b border-outline-variant mb-md gap-md">
                      <button
                        onClick={() => { setActivePrepTab('technical'); setDifficultyFilter('all'); }}
                        className={`pb-sm font-label-md text-label-md font-bold border-b-2 transition-all ${
                          activePrepTab === 'technical' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Technical Questions
                      </button>
                      <button
                        onClick={() => { setActivePrepTab('behavioral'); setDifficultyFilter('all'); }}
                        className={`pb-sm font-label-md text-label-md font-bold border-b-2 transition-all ${
                          activePrepTab === 'behavioral' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Behavioral Questions
                      </button>
                      <button
                        onClick={() => setActivePrepTab('weaknesses')}
                        className={`pb-sm font-label-md text-label-md font-bold border-b-2 transition-all ${
                          activePrepTab === 'weaknesses' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Weak Areas to Improve
                      </button>
                    </div>

                    {/* Questions list tabs */}
                    {activePrepTab !== 'weaknesses' ? (
                      <div className="space-y-md">
                        {/* Difficulty Filter Bar */}
                        <div className="flex items-center gap-sm flex-wrap mb-sm">
                          <span className="text-on-surface-variant font-label-sm text-label-sm mr-2">Difficulty:</span>
                          {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => { setDifficultyFilter(lvl as any); setExpandedQuestionIndex(null); }}
                              className={`px-sm py-0.5 rounded-full text-label-sm font-semibold capitalize border transition-all ${
                                difficultyFilter === lvl
                                  ? 'bg-primary border-primary text-white'
                                  : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>

                        {/* Accordion Questions */}
                        <div className="space-y-sm">
                          {(() => {
                            const filteredQuestions = (prepData.questions || []).filter(
                              (q: any) => q.type === activePrepTab && (difficultyFilter === 'all' || q.difficulty === difficultyFilter)
                            );

                            if (filteredQuestions.length === 0) {
                              return (
                                <p className="text-on-surface-variant font-body-sm text-center py-md bg-surface-container rounded-lg">
                                  No {activePrepTab} questions found matching the "{difficultyFilter}" difficulty filter.
                                </p>
                              );
                            }

                            return filteredQuestions.map((q: any, idx: number) => {
                              const isExpanded = expandedQuestionIndex === idx;
                              let difficultyBadgeColor = 'bg-success/10 text-success border-success/20';
                              if (q.difficulty === 'intermediate') difficultyBadgeColor = 'bg-warning/10 text-warning border-warning/20';
                              else if (q.difficulty === 'advanced') difficultyBadgeColor = 'bg-error/10 text-error border-error/20';

                              return (
                                <div key={idx} className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest">
                                  <button
                                    onClick={() => setExpandedQuestionIndex(isExpanded ? null : idx)}
                                    className="w-full p-md text-left flex justify-between items-center gap-md hover:bg-surface-container-low transition-colors"
                                  >
                                    <div className="flex items-center gap-md flex-1">
                                      <span className="material-symbols-outlined text-outline transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                                        chevron_right
                                      </span>
                                      <span className="font-label-md text-label-md text-on-surface font-bold flex-1">{q.question}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-label-sm font-bold border capitalize shrink-0 ${difficultyBadgeColor}`}>
                                      {q.difficulty}
                                    </span>
                                  </button>

                                  {isExpanded && (
                                    <div className="p-md bg-surface-container-low/50 border-t border-outline-variant space-y-md text-left">
                                      {/* Recruiter Intent */}
                                      <div className="p-md bg-secondary/5 border-l-4 border-secondary rounded-r-lg">
                                        <p className="text-secondary font-label-sm text-label-sm font-bold uppercase tracking-wider mb-1">Recruiter Intent</p>
                                        <p className="text-on-surface font-body-sm leading-relaxed">{q.recruiterIntent}</p>
                                      </div>
                                      {/* Suggested Answer */}
                                      <div>
                                        <p className="text-primary font-label-sm text-label-sm font-bold uppercase tracking-wider mb-1">Suggested Answer</p>
                                        <p className="text-on-surface font-body-md leading-relaxed whitespace-pre-line">{q.suggestedAnswer}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      /* Weak Areas */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md mt-sm">
                        {(!prepData.weaknesses || prepData.weaknesses.length === 0) ? (
                          <p className="col-span-2 text-on-surface-variant font-body-sm text-center py-md bg-surface-container rounded-lg">
                            No specific weaknesses identified. Keep practicing!
                          </p>
                        ) : (
                          prepData.weaknesses.map((w: any, idx: number) => (
                            <div key={idx} className="bg-surface-container-low border border-outline-variant/65 rounded-xl p-md flex flex-col justify-between text-left">
                              <div>
                                <div className="flex items-center gap-sm mb-sm text-tertiary">
                                  <span className="material-symbols-outlined text-md">warning</span>
                                  <h4 className="font-label-md text-label-md font-bold font-semibold uppercase tracking-wider">{w.skill}</h4>
                                </div>
                                <p className="text-on-surface-variant font-body-sm mb-md leading-relaxed">
                                  <strong className="text-on-surface block font-semibold mb-0.5">Observation:</strong>
                                  {w.reason}
                                </p>
                              </div>
                              <div className="p-sm bg-tertiary/5 border-l-4 border-tertiary rounded-r-lg">
                                <p className="text-tertiary font-label-sm text-label-sm font-bold uppercase tracking-wider mb-0.5">Recommendation</p>
                                <p className="text-on-surface font-body-sm font-medium">{w.recommendation}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-md text-center">
                    <p className="text-on-surface-variant font-body-sm">Select a job from the dropdown to start practicing.</p>
                  </div>
                )}
              </div>

              {/* AI Cover Letter Generator Hub */}
              <div id="cover-letter-hub" className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">description</span>
                      <h3 className="font-headline-md text-headline-md text-on-surface font-bold">AI Cover Letter Generator</h3>
                    </div>
                    <p className="text-on-surface-variant font-body-sm">
                      {selectedJobForCoverLetter
                        ? `Generating for ${selectedJobForCoverLetter.title} at ${selectedJobForCoverLetter.company}`
                        : "Select a job and choose a tone to generate a tailored cover letter."}
                    </p>
                  </div>
                  {selectedJobForCoverLetter && coverLetterData && (
                    <div className="flex gap-sm">
                      <button
                        onClick={() => {
                          setSelectedJobForCoverLetter(null);
                          setCoverLetterData(null);
                        }}
                        className="px-md py-sm border border-outline text-on-surface font-label-sm text-label-sm rounded-lg hover:bg-surface-container transition-all"
                      >
                        Change Job
                      </button>
                      <button
                        onClick={() => handleGenerateCoverLetter(selectedJobForCoverLetter._id, coverLetterTone, true)}
                        disabled={coverLetterLoading}
                        className="px-md py-sm bg-secondary text-white font-label-sm text-label-sm rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        {coverLetterLoading ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    </div>
                  )}
                </div>

                {coverLetterLoading ? (
                  <div className="flex flex-col items-center py-xl gap-md text-center">
                    <span className="w-10 h-10 border-4 border-tertiary border-t-transparent rounded-full animate-spin"></span>
                    <div>
                      <p className="font-label-md text-label-md text-on-surface font-bold">Drafting your cover letter...</p>
                      <p className="font-body-sm text-on-surface-variant max-w-sm mt-1">
                        Gemini is aligning your experience with the job description to write a compelling letter in {coverLetterTone} tone.
                      </p>
                    </div>
                  </div>
                ) : !selectedJobForCoverLetter ? (
                  <div className="py-md">
                    <div className="flex flex-col sm:flex-row gap-md items-end">
                      <div className="flex-grow">
                        <label className="block text-on-surface-variant font-label-sm text-label-sm font-semibold mb-sm">Select Target Position</label>
                        <select
                          onChange={(e) => {
                            const job = jobs.find(j => j._id === e.target.value);
                            if (job) {
                              handlePrepareCoverLetterClick(job);
                            }
                          }}
                          value=""
                          className="w-full px-md py-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface font-body-md"
                        >
                          <option value="" disabled>-- Select a job to generate for --</option>
                          {jobs.map((job) => (
                            <option key={job._id} value={job._id}>
                              {job.title} at {job.company} ({job.matchScore ? `${job.matchScore}% Match` : 'Matches'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-80">
                        <label className="block text-on-surface-variant font-label-sm text-label-sm font-semibold mb-sm">Choose Tone</label>
                        <div className="flex bg-surface-container p-1 rounded-lg gap-1 border border-outline-variant">
                          {(['professional', 'enthusiastic', 'concise'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setCoverLetterTone(t)}
                              className={`flex-1 py-1.5 text-center rounded text-label-sm font-semibold capitalize transition-all ${
                                coverLetterTone === t
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : coverLetterData ? (
                  <div className="space-y-md">
                    {/* Tone Select and Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-md p-sm bg-surface-container rounded-xl border border-outline-variant/50">
                      <div className="flex items-center gap-sm">
                        <span className="text-on-surface-variant font-label-sm text-label-sm font-bold shrink-0">Tone:</span>
                        <div className="flex bg-surface-container-low p-0.5 rounded-lg gap-0.5 border border-outline-variant/40">
                          {(['professional', 'enthusiastic', 'concise'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => handleToneChange(t)}
                              className={`px-sm py-1 rounded text-label-sm font-semibold capitalize transition-all ${
                                coverLetterTone === t
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-sm justify-end">
                        <button
                          onClick={handleCopyCoverLetter}
                          className="px-md py-1.5 bg-surface-container-highest border border-outline-variant text-on-surface font-label-sm text-label-sm font-bold rounded-lg hover:bg-surface-container-low transition-all flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-md">
                            {copyFeedback ? 'check' : 'content_copy'}
                          </span>
                          {copyFeedback ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={handleDownloadCoverLetter}
                          className="px-md py-1.5 bg-primary text-white font-label-sm text-label-sm font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-md">download</span>
                          Download .txt
                        </button>
                      </div>
                    </div>

                    {/* Letter Body */}
                    <div className="relative group bg-surface-container-low border border-outline-variant p-lg rounded-xl overflow-hidden shadow-inner">
                      <div className="font-body-md text-on-surface whitespace-pre-wrap select-text max-h-[500px] overflow-y-auto leading-relaxed pr-md">
                        {coverLetterData.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-md text-center">
                    <p className="text-on-surface-variant font-body-sm">Select a job to generate a tailored cover letter.</p>
                  </div>
                )}
              </div>

              {/* Job Recommendations */}
              <div>
                <div className="flex justify-between items-center mb-lg">
                  <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold">Recommended for You</h3>
                  <Link href="/jobs" className="text-primary font-label-md text-label-md font-bold hover:underline">
                    View all matches
                  </Link>
                </div>
                <div className="space-y-md text-left">
                  {jobs.length === 0 ? (
                    <div className="bg-white border border-outline-variant p-xl rounded-xl text-center text-on-surface-variant">
                      No jobs recommended yet. Please upload a resume to enable compatibility matching.
                    </div>
                  ) : (
                    jobs.slice(0, 3).map((job) => (
                      <div key={job._id} className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-all flex flex-col md:flex-row gap-lg group">
                        <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant">
                          {job.logoUrl ? (
                            <img alt={job.company} className="w-10 h-10 object-contain" src={job.logoUrl} />
                          ) : (
                            <span className="material-symbols-outlined text-outline text-3xl">work</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link href={`/jobs/${job._id}`}>
                                <h4 className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors font-bold">
                                  {job.title}
                                </h4>
                              </Link>
                              <p className="text-on-surface-variant font-body-sm">{job.company} • {job.location} • {job.type}</p>
                            </div>
                            {job.matchScore !== undefined && job.matchScore !== null && (
                              <span className="bg-primary/10 text-primary px-sm py-1 rounded-full text-label-sm font-bold animate-pulse">
                                {job.matchScore}% Match
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-md">
                            {(job.requiredSkills || []).slice(0, 4).map((skill, i) => (
                              <span key={i} className="px-2 py-1 bg-surface-container text-on-surface-variant rounded-md text-label-sm font-semibold">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex md:flex-col justify-end gap-sm shrink-0">
                          <button
                            onClick={() => handleQuickApply(job._id)}
                            disabled={applyingId === job._id}
                            className="px-lg py-sm bg-primary text-white rounded-lg font-label-sm text-label-sm font-bold hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center"
                          >
                            {applyingId === job._id ? 'Applying...' : 'Quick Apply'}
                          </button>
                          <button
                            onClick={() => handlePrepareInterviewClick(job)}
                            className="px-lg py-sm border border-secondary text-secondary rounded-lg font-label-sm text-label-sm font-bold hover:bg-secondary/5 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">forum</span>
                            Practice
                          </button>
                          <button
                            onClick={() => handlePrepareCoverLetterClick(job)}
                            className="px-lg py-sm border border-tertiary text-tertiary rounded-lg font-label-sm text-label-sm font-bold hover:bg-tertiary/5 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">description</span>
                            Cover Letter
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Activity & Insights Sidebar */}
            <div className="lg:col-span-4 space-y-xl text-left">
              {/* Recent Activities */}
              <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm">
                <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold mb-lg">Recent Activities</h3>
                {activities.length === 0 ? (
                  <p className="text-on-surface-variant font-body-sm text-center py-md">No recent activities logged.</p>
                ) : (
                  <div className="space-y-xl relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant">
                    {activities.map((act) => {
                      let dotColor = 'bg-primary';
                      let bgColor = 'bg-primary/20';
                      if (act.type.includes('Reject') || act.type.includes('Cancel')) {
                        dotColor = 'bg-error';
                        bgColor = 'bg-error/20';
                      } else if (act.type.includes('Accept') || act.type.includes('Success')) {
                        dotColor = 'bg-success';
                        bgColor = 'bg-success/20';
                      } else if (act.type.includes('Job') || act.type.includes('Apply')) {
                        dotColor = 'bg-secondary';
                        bgColor = 'bg-secondary/20';
                      } else if (act.type.includes('Profile') || act.type.includes('Update')) {
                        dotColor = 'bg-tertiary';
                        bgColor = 'bg-tertiary/20';
                      }

                      return (
                        <div key={act._id} className="relative pl-8">
                          <div className={`absolute left-0 top-1.5 w-6 h-6 ${bgColor} rounded-full flex items-center justify-center`}>
                            <div className={`w-2 h-2 ${dotColor} rounded-full`}></div>
                          </div>
                          <p className="font-label-md text-label-md text-on-surface font-bold">{act.type}</p>
                          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{act.description}</p>
                          <span className="font-label-sm text-label-sm text-outline mt-1 block">{act.timestampLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Market Insights */}
              <div className="bg-surface-container p-xl rounded-2xl">
                <div className="flex items-center gap-md mb-md">
                  <span className="material-symbols-outlined text-primary">insights</span>
                  <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">Market Insights</h3>
                </div>
                <div className="space-y-md">
                  {marketInsights.map((insight, idx) => (
                    <div key={idx} className="p-md bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-label-md text-label-md text-on-surface font-bold font-semibold">{insight.title}</span>
                        {insight.badge && (
                          <span className="text-error text-label-sm font-bold">{insight.badge}</span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{insight.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
