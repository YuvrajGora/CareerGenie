'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const isActive = (path: string) => {
    return pathname === path;
  };

  const linkClass = (path: string) => {
    return `flex items-center gap-3 px-md py-sm rounded-lg transition-all duration-200 ease-in-out ${
      isActive(path)
        ? 'bg-secondary-container text-on-secondary-container font-semibold'
        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
    }`;
  };

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-surface border-r border-outline-variant flex flex-col p-md space-y-sm hidden md:flex">
      <div className="mb-xl px-sm">
        <Link href="/dashboard">
          <h1 className="font-headline-xl text-headline-xl font-black text-primary cursor-pointer">CareerGenie</h1>
        </Link>
        <div className="flex items-center justify-between">
          <p className="font-label-sm text-label-sm text-on-surface-variant">AI Recruitment Hub</p>
          {user.role === 'admin' && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-error/15 text-error">
              Admin
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {/* Common Dashboard gateway */}
        <Link href="/dashboard" className={linkClass('/dashboard')}>
          <span className="material-symbols-outlined">dashboard</span>
          <span className="font-label-md text-label-md">
            {user.role === 'admin' ? 'Admin Overview' : 'Dashboard'}
          </span>
        </Link>

        {/* Student specific links */}
        {user.role === 'student' && (
          <>
            <Link href="/resume" className={linkClass('/resume')}>
              <span className="material-symbols-outlined">description</span>
              <span className="font-label-md text-label-md">Resume Analysis</span>
            </Link>
            <Link href="/jobs" className={linkClass('/jobs')}>
              <span className="material-symbols-outlined">work</span>
              <span className="font-label-md text-label-md">Job Matches</span>
            </Link>
            <Link href="/applications" className={linkClass('/applications')}>
              <span className="material-symbols-outlined">send</span>
              <span className="font-label-md text-label-md">Applications</span>
            </Link>
          </>
        )}

        {/* Recruiter specific links */}
        {user.role === 'recruiter' && (
          <>
            <Link href="/hr" className={linkClass('/hr')}>
              <span className="material-symbols-outlined">space_dashboard</span>
              <span className="font-label-md text-label-md font-bold">HR Command Center</span>
            </Link>
            <Link href="/hr/recruitment" className={linkClass('/hr/recruitment')}>
              <span className="material-symbols-outlined">person_search</span>
              <span className="font-label-md text-label-md">Recruitment Intelligence</span>
            </Link>
            <Link href="/hr/skills" className={linkClass('/hr/skills')}>
              <span className="material-symbols-outlined">hub</span>
              <span className="font-label-md text-label-md">Skill Intelligence</span>
            </Link>
            <Link href="/hr/risks" className={linkClass('/hr/risks')}>
              <span className="material-symbols-outlined">radar</span>
              <span className="font-label-md text-label-md">Risk & Retention Radar</span>
            </Link>
            <Link href="/hr/policies" className={linkClass('/hr/policies')}>
              <span className="material-symbols-outlined">policy</span>
              <span className="font-label-md text-label-md">Policy Intelligence</span>
            </Link>
            <Link href="/hr/onboarding" className={linkClass('/hr/onboarding')}>
              <span className="material-symbols-outlined">assignment_ind</span>
              <span className="font-label-md text-label-md">Adaptive Onboarding</span>
            </Link>
            <Link href="/hr/interviews" className={linkClass('/hr/interviews')}>
              <span className="material-symbols-outlined">psychology_alt</span>
              <span className="font-label-md text-label-md">Interview Intelligence</span>
            </Link>
            <Link href="/recruiter/create-job" className={linkClass('/recruiter/create-job')}>
              <span className="material-symbols-outlined">add_box</span>
              <span className="font-label-md text-label-md">Post a Job</span>
            </Link>
          </>
        )}

        {/* Admin specific links */}
        {user.role === 'admin' && (
          <>
            <Link href="/hr" className={linkClass('/hr')}>
              <span className="material-symbols-outlined">space_dashboard</span>
              <span className="font-label-md text-label-md font-bold">HR Command Center</span>
            </Link>
            <Link href="/hr/recruitment" className={linkClass('/hr/recruitment')}>
              <span className="material-symbols-outlined">person_search</span>
              <span className="font-label-md text-label-md">Recruitment Intelligence</span>
            </Link>
            <Link href="/hr/skills" className={linkClass('/hr/skills')}>
              <span className="material-symbols-outlined">hub</span>
              <span className="font-label-md text-label-md">Skill Intelligence</span>
            </Link>
            <Link href="/hr/risks" className={linkClass('/hr/risks')}>
              <span className="material-symbols-outlined">radar</span>
              <span className="font-label-md text-label-md">Risk & Retention Radar</span>
            </Link>
            <Link href="/hr/policies" className={linkClass('/hr/policies')}>
              <span className="material-symbols-outlined">policy</span>
              <span className="font-label-md text-label-md">Policy Intelligence</span>
            </Link>
            <Link href="/hr/onboarding" className={linkClass('/hr/onboarding')}>
              <span className="material-symbols-outlined">assignment_ind</span>
              <span className="font-label-md text-label-md">Adaptive Onboarding</span>
            </Link>
            <Link href="/hr/interviews" className={linkClass('/hr/interviews')}>
              <span className="material-symbols-outlined">psychology_alt</span>
              <span className="font-label-md text-label-md">Interview Intelligence</span>
            </Link>
            <Link href="/jobs" className={linkClass('/jobs')}>
              <span className="material-symbols-outlined">work</span>
              <span className="font-label-md text-label-md">Manage Jobs</span>
            </Link>
            <Link href="/recruiter/create-job" className={linkClass('/recruiter/create-job')}>
              <span className="material-symbols-outlined">add_box</span>
              <span className="font-label-md text-label-md">Create Job</span>
            </Link>
            <Link href="/applications" className={linkClass('/applications')}>
              <span className="material-symbols-outlined">fact_check</span>
              <span className="font-label-md text-label-md">All Applications</span>
            </Link>
          </>
        )}

        {/* Common Profile link */}
        <Link href="/profile" className={linkClass('/profile')}>
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md">Profile</span>
        </Link>
      </nav>

      <div className="pt-xl border-t border-outline-variant space-y-1">
        {user.role === 'student' && (
          <button className="w-full bg-primary text-on-primary py-sm rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all mb-md">
            Upgrade to Pro
          </button>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-md py-sm text-on-surface-variant hover:bg-surface-container-low hover:text-error rounded-lg text-left transition-colors"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label-md text-label-md">Logout</span>
        </button>
      </div>
    </aside>
  );
}
