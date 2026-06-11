'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Application {
  _id: string;
  jobId: {
    _id: string;
    title: string;
    company: string;
  };
  studentId: {
    _id: string;
    name: string;
    email: string;
    skills: string[];
    education?: string;
  };
  status: string;
  matchScore: number;
  appliedAt: string;
}

export default function RecruiterDashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load applications for recruiter:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    setUpdatingId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) => (app._id === appId ? { ...app, status: newStatus } : app))
        );
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update application status.');
      }
    } catch (err) {
      alert('Error updating status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const onSelectChange = (appId: string, newStatus: string) => {
    if (newStatus === 'rejected') {
      setPendingRejectId(appId);
    } else {
      handleStatusChange(appId, newStatus);
    }
  };


  const avgMatchScore = applications.length
    ? Math.round(applications.reduce((acc, app) => acc + app.matchScore, 0) / applications.length)
    : 0;

  const totalPostings = Array.from(new Set(applications.map((app) => app.jobId?._id))).length;

  return (
    <div className="pt-24 px-lg pb-xl max-w-max-width mx-auto">
      <div className="mb-xl flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div className="text-left">
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-black">Welcome back, {user?.name}!</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Recruiter Dashboard • Manage active candidate applications and match pipelines.
          </p>
        </div>
        <Link
          href="/recruiter/create-job"
          className="px-lg py-sm bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all text-center font-bold"
        >
          Post a New Job
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-2xl">
          <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl text-left">
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">work</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Active Jobs Managed</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{totalPostings || 1}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">people</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Total Applicants</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{applications.length}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">trending_up</span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Average Match Score</p>
              <p className="text-3xl font-bold text-primary mt-1">{avgMatchScore}%</p>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-lg border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-headline-lg text-headline-lg font-bold text-sm md:text-lg">Applicants Ledger</h3>
              <span className="px-md py-1 bg-primary/10 text-primary text-xs rounded-full font-bold">
                {applications.length} Profiles
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Candidate</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Applied Position</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold text-center">Match Match</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Status Stage</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant bg-white">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-lg py-xl text-center text-on-surface-variant text-body-md">
                        No applications received yet.
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app._id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-lg py-md">
                          <div className="flex flex-col">
                            <span className="font-body-md text-body-md font-bold text-on-surface">{app.studentId?.name}</span>
                            <span className="text-xs text-on-surface-variant">{app.studentId?.email}</span>
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                            {app.jobId?.title}
                          </span>
                        </td>
                        <td className="px-lg py-md text-center">
                          <span className="px-md py-1 bg-primary/10 text-primary rounded-full text-xs font-black">
                            {app.matchScore}%
                          </span>
                        </td>
                        <td className="px-lg py-md">
                          <span className={`px-sm py-1 rounded-full text-[10px] font-black uppercase ${
                            app.status === 'accepted'
                              ? 'bg-primary/20 text-primary'
                              : app.status === 'rejected'
                              ? 'bg-error/15 text-error'
                              : 'bg-secondary-container/20 text-secondary'
                          }`}>
                            {app.status === 'accepted' ? 'offered' : app.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-lg py-md">
                          <select
                            disabled={updatingId === app._id}
                            value={app.status}
                            onChange={(e) => onSelectChange(app._id, e.target.value)}
                            className="bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-label-sm text-label-sm p-sm rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                          >
                            <option value="applied">Applied</option>
                            <option value="interviewing">Interview</option>
                            <option value="accepted">Offered</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pendingRejectId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-white border border-outline-variant rounded-xl shadow-xl max-w-md w-full p-lg text-left">
            <h3 className="font-headline-lg text-headline-lg text-error font-bold mb-md">
              Confirm Rejection
            </h3>
            <p className="text-on-surface-variant text-body-md mb-lg">
              Are you sure you want to reject this applicant?
            </p>
            <div className="flex justify-end gap-md">
              <button
                onClick={() => setPendingRejectId(null)}
                className="px-lg py-sm border border-outline-variant text-on-surface font-semibold rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer animate-none"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleStatusChange(pendingRejectId, 'rejected');
                  setPendingRejectId(null);
                }}
                className="px-lg py-sm bg-error text-white font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer animate-none"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
