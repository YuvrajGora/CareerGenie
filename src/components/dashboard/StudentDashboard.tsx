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

interface Application {
  _id: string;
  jobId: {
    _id: string;
    title: string;
    company: string;
  };
  status: string;
  createdAt: string;
}

export default function StudentDashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      // Fetch jobs matching user skills
      const skillsQuery = user?.skills && user.skills.length > 0 ? `?skills=${encodeURIComponent(user.skills.join(','))}` : '';
      const jobsRes = await fetch(`/api/jobs${skillsQuery}`);
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
      }

      // Fetch applications
      const appsRes = await fetch('/api/applications');
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApplications(appsData.applications || []);
      }

      // Fetch resume score from latest analysis
      const resumeRes = await fetch('/api/resumes/analysis');
      if (resumeRes.ok) {
        const resumeData = await resumeRes.json();
        if (resumeData.analysis) {
          setResumeScore(resumeData.analysis.overallScore);
        }
      } else {
        setResumeScore(null);
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
        // Refresh application state
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

  const pendingApps = applications.filter((app) => ['applied', 'interviewing'].includes(app.status)).length;
  const rejectedApps = applications.filter((app) => app.status === 'rejected').length;

  return (
    <div className="pt-24 px-lg pb-xl max-w-max-width mx-auto">
      {/* Welcome Header */}
      <div className="mb-xl flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-black">Welcome back, {user?.name}!</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Your profile is active. You matched with {jobs.length} new companies recently.
          </p>
        </div>
        <Link href="/resume" className="px-lg py-sm bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:brightness-110 transition-all text-center">
          Upload New Resume
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-2xl">
          <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : (
        <>
          {/* Bento Grid Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">description</span>
                <span className="text-primary font-label-sm text-label-sm font-semibold">+2% this week</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Resume Score</p>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-bold text-on-surface">{resumeScore !== null ? resumeScore : 'N/A'}</span>
                <span className="text-on-surface-variant font-body-sm pb-1">/100</span>
              </div>
              <div className="w-full bg-surface-variant h-1.5 rounded-full mt-md">
                <div className="bg-primary h-full rounded-full" style={{ width: `${resumeScore || 0}%` }}></div>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">auto_awesome</span>
                <span className="text-primary font-label-sm text-label-sm font-semibold">New matches</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Jobs Matched</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{jobs.length}</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-md">Based on your interests</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">send</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Applications Sent</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{applications.length}</p>
              <div className="flex gap-2 mt-md">
                <span className="px-2 py-0.5 bg-surface-container rounded text-label-sm font-medium">{pendingApps} Pending</span>
                <span className="px-2 py-0.5 bg-surface-container rounded text-label-sm font-medium">{rejectedApps} Rejected</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">trending_up</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Interview Chances</p>
              <p className="text-3xl font-bold text-primary mt-1">High</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-md">Top 5% of candidates</p>
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
                    <span className="material-symbols-outlined">bolt</span>
                    <span className="font-label-md text-label-md uppercase tracking-wider font-bold">AI Optimization Insight</span>
                  </div>
                  <h3 className="font-headline-lg text-headline-lg mb-sm font-bold">Boost your employability</h3>
                  <p className="font-body-lg text-body-lg opacity-90 max-w-lg">
                    Adding <span className="font-bold underline">TypeScript</span> and <span className="font-bold underline">Docker</span> to your skills section will increase your matching score by approximately <span className="font-black">15%</span> for the roles you&apos;re targeting.
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
                            <span className="bg-primary/10 text-primary px-sm py-1 rounded-full text-label-sm font-bold">
                              {job.matchScore || 85}% Match
                            </span>
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
                <div className="space-y-xl relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant">
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                    <p className="font-label-md text-label-md text-on-surface font-bold">Resume Uploaded</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Resume analysis completed with premium AI score calculation.</p>
                    <span className="font-label-sm text-label-sm text-outline mt-1 block">Just now</span>
                  </div>
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-secondary/20 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    </div>
                    <p className="font-label-md text-label-md text-on-surface font-bold">New Skills Match</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Found matches for updated resume parameters.</p>
                    <span className="font-label-sm text-label-sm text-outline mt-1 block">5 hours ago</span>
                  </div>
                </div>
              </div>

              {/* Market Insights */}
              <div className="bg-surface-container p-xl rounded-2xl">
                <div className="flex items-center gap-md mb-md">
                  <span className="material-symbols-outlined text-primary">insights</span>
                  <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">Market Insights</h3>
                </div>
                <div className="space-y-md">
                  <div className="p-md bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label-md text-label-md text-on-surface font-bold font-semibold">Trending Roles</span>
                      <span className="text-error text-label-sm font-bold">Hot</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">DevOps roles have seen a 25% spike in student hires this month.</p>
                  </div>
                  <div className="p-md bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label-md text-label-md text-on-surface font-bold font-semibold">In-Demand Skills</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Next.js and Tailwind CSS v4 are highly valued in modern frontend descriptions.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
