'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface ApplicationItem {
  _id: string;
  studentId: any;
  jobId: {
    _id: string;
    title: string;
    company: string;
    description: string;
    location: string;
    experience: number;
    salaryMin: number;
    salaryMax: number;
    requiredSkills: string[];
  };
  matchScore: number;
  status: 'applied' | 'interviewing' | 'accepted' | 'rejected';
  appliedAt: string;
}

export default function ApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    } else if (user) {
      fetchApplications();
    }
  }, [user, authLoading, router]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to fetch applications.');
      }
    } catch (err) {
      setError('Network error loading applications.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appId: string, newStatus: 'applied' | 'interviewing' | 'accepted' | 'rejected') => {
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchApplications();
      } else {
        const data = await res.json();
        alert(data.error || 'Could not update application status.');
      }
    } catch (err) {
      alert('Network error updating status.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  // Filter application items
  const filteredApps = applications.filter((app) => {
    const jobTitle = app.jobId?.title?.toLowerCase() || '';
    const company = app.jobId?.company?.toLowerCase() || '';
    const term = filterText.toLowerCase();
    return jobTitle.includes(term) || company.includes(term);
  });

  // Columns: Applied, Interviewing, Accepted (Selected), Rejected
  const columns: Array<{
    id: 'applied' | 'interviewing' | 'accepted' | 'rejected';
    title: string;
    color: string;
    bg: string;
  }> = [
    { id: 'applied', title: 'Applied', color: 'bg-primary', bg: 'bg-primary/10' },
    { id: 'interviewing', title: 'Interviewing', color: 'bg-tertiary', bg: 'bg-tertiary/10' },
    { id: 'accepted', title: 'Selected', color: 'bg-emerald-500', bg: 'bg-emerald-50/50' },
    { id: 'rejected', title: 'Rejected', color: 'bg-error', bg: 'bg-error/10' },
  ];

  return (
    <div className="mt-20 px-lg pb-xl min-h-screen text-left max-w-max-width mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-xl gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary font-bold">Application Tracker</h2>
          <p className="text-on-surface-variant font-body-md font-semibold">
            {user.role === 'student'
              ? 'Manage your job search pipeline with AI-driven insights.'
              : 'Track and evaluate candidate pipelines for your active postings.'}
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <div className="flex items-center bg-surface-container-low px-md py-xs rounded-lg border border-outline-variant">
            <span className="material-symbols-outlined text-outline">search</span>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-body-sm font-semibold w-48 outline-none pl-xs"
              placeholder="Search applications..."
              type="text"
            />
          </div>
          {user.role === 'student' && (
            <button
              onClick={() => router.push('/jobs')}
              className="flex items-center gap-xs px-md py-sm bg-primary text-white rounded-lg text-label-md font-bold hover:brightness-110 shadow-sm transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">add</span> Find Jobs
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md overflow-x-auto pb-lg">
        {columns.map((col) => {
          const colApps = filteredApps.filter((app) => app.status === col.id);

          return (
            <div key={col.id} className="flex flex-col gap-md bg-surface-container-low/40 rounded-xl p-md min-h-[500px] border border-outline-variant/50">
              {/* Header */}
              <div className="flex items-center justify-between px-xs mb-sm">
                <div className="flex items-center gap-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.color}`}></span>
                  <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-bold">{col.title}</h3>
                  <span className="text-label-sm font-bold bg-surface-container-high px-sm py-xs rounded-full">
                    {colApps.length}
                  </span>
                </div>
              </div>

              {/* Application Cards */}
              <div className="flex-1 space-y-md">
                {colApps.length === 0 ? (
                  <div className="border border-dashed border-outline-variant/60 rounded-xl p-lg flex flex-col items-center justify-center text-center opacity-50 h-32">
                    <p className="text-body-sm text-outline font-semibold">No applications</p>
                  </div>
                ) : (
                  colApps.map((app) => (
                    <div
                      key={app._id}
                      className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl shadow-sm hover:shadow-md transition-shadow group relative text-left"
                    >
                      <div className="flex justify-between items-start mb-sm">
                        <div>
                          <h4 className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors font-bold">
                            {app.jobId?.company || 'Company'}
                          </h4>
                          <p className="text-label-sm font-semibold text-on-surface-variant">{app.jobId?.title || 'Job Title'}</p>
                        </div>
                        <span className="text-xs text-outline font-semibold">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="space-y-sm">
                        <div className="flex items-center gap-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">location_on</span>
                          <span className="text-label-sm font-semibold">{app.jobId?.location || 'Remote'}</span>
                        </div>

                        {/* Progress Meter simulated for interview / review process */}
                        <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${col.color}`}
                            style={{
                              width:
                                col.id === 'applied'
                                  ? '25%'
                                  : col.id === 'interviewing'
                                  ? '75%'
                                  : '100%',
                            }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center pt-xs">
                          <div className="flex items-center gap-xs">
                            <span className="text-label-sm font-bold px-sm py-xs bg-primary/10 text-primary rounded">
                              Match Score: {app.matchScore}%
                            </span>
                          </div>
                          <button
                            onClick={() => router.push(`/jobs/${app.jobId?._id}`)}
                            className="text-label-sm text-primary font-bold hover:underline"
                          >
                            Details
                          </button>
                        </div>

                        {/* Interview Intelligence shortcut */}
                        {(user.role === 'recruiter' || user.role === 'admin') && app.status === 'interviewing' && (
                          <button
                            onClick={() => router.push(`/hr/interviews?applicationId=${app._id}`)}
                            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1 px-2 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs font-bold transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">psychology_alt</span>
                            Evaluate Interview
                          </button>
                        )}

                        {/* Status switcher for recruiters or demo purposes */}
                        {(user.role === 'recruiter' || user.role === 'admin') && (
                          <div className="mt-md pt-md border-t border-outline-variant/30 flex flex-wrap gap-xs">
                            <span className="text-[10px] text-outline block w-full mb-1 font-bold">Change Status</span>
                            {columns
                              .filter((c) => c.id !== app.status)
                              .map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => updateStatus(app._id, c.id)}
                                  className="px-xs py-1 hover:bg-surface-container-high border border-outline-variant/60 rounded text-[10px] font-bold"
                                >
                                  {c.title}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
