'use client';

import React, { useState, useEffect } from 'react';

interface SystemMetrics {
  users: {
    student: number;
    recruiter: number;
    admin: number;
    total: number;
  };
  jobs: {
    active: number;
    closed: number;
    total: number;
  };
  applications: {
    total: number;
    averageMatchScore: number;
  };
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboard({ user: currentAdmin }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [metricsRes, usersRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/users'),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action is irreversible.')) {
      return;
    }

    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u._id !== userId));
        // Refresh metrics
        const metricsRes = await fetch('/api/admin/metrics');
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data.metrics);
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Error communicating with backend API.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pt-24 px-lg pb-xl max-w-max-width mx-auto">
      <div className="mb-xl text-left">
        <h2 className="font-headline-lg text-headline-lg text-on-surface font-black">Admin Panel</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          System Overview • Manage user registrations, review active job statistics, and handle core moderation tasks.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-2xl">
          <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : (
        <>
          {/* System Telemetry */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xl text-left">
              <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Total Accounts</p>
                <p className="text-3xl font-bold text-on-surface mt-1">{metrics.users.total}</p>
                <div className="flex gap-2 mt-md text-xs font-semibold">
                  <span className="px-2 py-0.5 bg-surface-container rounded">{metrics.users.student} Students</span>
                  <span className="px-2 py-0.5 bg-surface-container rounded">{metrics.users.recruiter} Recruiters</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Active Jobs</p>
                <p className="text-3xl font-bold text-on-surface mt-1">{metrics.jobs.active}</p>
                <p className="text-label-sm font-label-sm text-outline mt-md">{metrics.jobs.total} total postings</p>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Applications Filed</p>
                <p className="text-3xl font-bold text-on-surface mt-1">{metrics.applications.total}</p>
                <p className="text-label-sm font-label-sm text-outline mt-md">Direct student connections</p>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                <p className="text-on-surface-variant font-label-md text-label-md font-semibold">Avg Match Score</p>
                <p className="text-3xl font-bold text-primary mt-1">{metrics.applications.averageMatchScore}%</p>
                <p className="text-label-sm font-label-sm text-outline mt-md">Resume matching algorithm accuracy</p>
              </div>
            </div>
          )}

          {/* User Moderation Section */}
          <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-lg border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-headline-lg text-headline-lg font-bold text-sm md:text-lg">Registered Users</h3>
              <span className="px-md py-1 bg-primary/10 text-primary text-xs rounded-full font-bold">
                {users.length} Total Registered
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">User</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Email</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Role</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold">Joined Date</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant bg-white">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-lg py-xl text-center text-on-surface-variant text-body-md">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-lg py-md">
                          <span className="font-body-md text-body-md font-bold text-on-surface">{u.name}</span>
                        </td>
                        <td className="px-lg py-md">
                          <span className="font-body-sm text-body-sm text-on-surface-variant">{u.email}</span>
                        </td>
                        <td className="px-lg py-md">
                          <span className={`px-sm py-1 rounded-full text-[10px] font-black uppercase ${
                            u.role === 'admin'
                              ? 'bg-error-container text-error'
                              : u.role === 'recruiter'
                              ? 'bg-secondary-container/20 text-secondary'
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-lg py-md">
                          <span className="font-body-sm text-body-sm text-outline">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-lg py-md text-right">
                          <button
                            disabled={deletingId === u._id || u._id === currentAdmin?._id}
                            onClick={() => handleDeleteUser(u._id)}
                            className="text-error font-label-sm text-label-sm font-bold hover:underline disabled:opacity-50 disabled:no-underline"
                          >
                            {deletingId === u._id ? 'Deleting...' : 'Delete'}
                          </button>
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
    </div>
  );
}
