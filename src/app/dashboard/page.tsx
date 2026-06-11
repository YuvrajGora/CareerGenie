'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import RecruiterDashboard from '@/components/dashboard/RecruiterDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';

export default function DashboardGateway() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-md">
          <span className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
          <p className="text-on-surface-variant font-label-md text-label-md font-bold">Synchronizing session state...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  // Render dashboard based on user role
  if (user.role === 'recruiter') {
    return <RecruiterDashboard user={user} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard user={user} />;
  }

  // Fallback or explicit student
  return <StudentDashboard user={user} />;
}
