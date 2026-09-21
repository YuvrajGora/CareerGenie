'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function Header() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll notifications every 30s
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Handle click outside to close panels
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(event.target as Node) &&
        notificationButtonRef.current &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', { method: 'PUT' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const timeAgo = (dateStr: string) => {
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(elapsed / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant shadow-sm px-lg py-sm">
        <div className="flex justify-between items-center max-w-max-width mx-auto">
          {/* Mobile hamburger menu toggle */}
          <div className="flex items-center gap-md md:hidden">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="text-on-surface-variant hover:text-primary p-xs rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <Link href="/dashboard">
              <span className="font-headline-lg text-headline-lg font-black text-primary">CareerGenie</span>
            </Link>
          </div>

          {/* Search bar desktop */}
          <div className="hidden md:flex flex-1 items-center gap-md">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-body-sm font-body-sm text-on-surface placeholder:text-outline"
                placeholder="Search jobs, skills, companies..."
                type="text"
              />
            </div>
          </div>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-lg ml-lg">
            {/* Notification Bell */}
            <div className="relative">
              <button
                ref={notificationButtonRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-on-surface-variant hover:text-primary p-xs rounded-full transition-colors relative"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-surface">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifications && (
                <div
                  ref={notificationPanelRef}
                  className="absolute right-0 mt-2 w-80 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-md border-b border-outline-variant flex justify-between items-center">
                    <h3 className="font-label-md text-label-md text-on-surface">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-primary font-label-sm text-label-sm hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-outline-variant bg-surface">
                    {notifications.length === 0 ? (
                      <div className="p-xl text-center text-on-surface-variant text-body-sm">
                        No new notifications.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => markSingleRead(n._id)}
                          className={`p-md hover:bg-surface-container-low transition-colors cursor-pointer flex gap-3 relative ${
                            !n.read ? 'bg-surface-container-low/40' : ''
                          }`}
                        >
                          {!n.read && (
                            <div className="w-2 h-2 bg-primary rounded-full absolute right-4 top-1/2 -translate-y-1/2"></div>
                          )}
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-primary text-md">info</span>
                          </div>
                          <div className="pr-4">
                            <p className="font-label-md text-label-md text-on-surface leading-snug">{n.title}</p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-tight">{n.message}</p>
                            <span className="text-[11px] text-outline mt-1 block">{timeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Dropdown */}
            <div className="relative flex items-center gap-sm pl-md border-l border-outline-variant">
              <button
                ref={profileButtonRef}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-sm group focus:outline-none cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant shrink-0 bg-surface-container-high flex items-center justify-center">
                  {user.profileImage ? (
                    <img
                      alt={user.name}
                      src={user.profileImage}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-outline">person</span>
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="font-label-md text-label-md text-on-surface leading-none group-hover:text-primary transition-colors font-bold">{user.name}</p>
                  <div className="text-[10px] text-on-surface-variant capitalize mt-0.5 flex items-center gap-1">
                    <span>{user.role}</span>
                    {user.role === 'admin' && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-error/15 text-error">Admin</span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline text-sm group-hover:text-primary transition-colors">arrow_drop_down</span>
              </button>

              {/* Profile Menu Dropdown Panel */}
              {showProfileMenu && (
                <div
                  ref={profileMenuRef}
                  className="absolute right-0 top-full mt-2 w-48 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-md border-b border-outline-variant">
                    <p className="font-label-md text-label-md text-on-surface truncate font-bold">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-on-surface-variant truncate capitalize">{user.role}</p>
                      {user.role === 'admin' && (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-error/15 text-error">Admin</span>
                      )}
                    </div>
                  </div>
                  <div className="py-sm">
                    <Link
                      href="/dashboard"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-md py-2 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-md">dashboard</span>
                      <span className="font-label-md text-label-md">Dashboard</span>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-md py-2 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-md">person</span>
                      <span className="font-label-md text-label-md">My Profile</span>
                    </Link>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-md py-2 text-error hover:bg-surface-container-low transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-md text-error">logout</span>
                      <span className="font-label-md text-label-md">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu overlays */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-on-background/40 backdrop-blur-sm">
          <div className="w-64 bg-surface h-full flex flex-col p-md space-y-sm shadow-xl animate-slide-in">
            <div className="flex justify-between items-center mb-xl px-sm">
              <div>
                <h1 className="font-headline-xl text-headline-xl font-black text-primary">CareerGenie</h1>
                <p className="font-label-sm text-label-sm text-on-surface-variant">AI Recruitment Hub</p>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="text-on-surface-variant hover:text-primary p-xs rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined">dashboard</span>
                <span className="font-label-md text-label-md">Dashboard</span>
              </Link>
              {user.role === 'student' && (
                <>
                  <Link
                    href="/resume"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">description</span>
                    <span className="font-label-md text-label-md">Resume Analysis</span>
                  </Link>
                  <Link
                    href="/jobs"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">work</span>
                    <span className="font-label-md text-label-md">Job Matches</span>
                  </Link>
                  <Link
                    href="/applications"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">send</span>
                    <span className="font-label-md text-label-md">Applications</span>
                  </Link>
                </>
              )}
              {user.role === 'recruiter' && (
                <>
                  <Link
                    href="/hr/risks"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">radar</span>
                    <span className="font-label-md text-label-md">Risk & Retention Radar</span>
                  </Link>
                  <Link
                    href="/hr/policies"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">policy</span>
                    <span className="font-label-md text-label-md">Policy Intelligence</span>
                  </Link>
                  <Link
                    href="/recruiter/create-job"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">add_box</span>
                    <span className="font-label-md text-label-md">Post a Job</span>
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <>
                  <Link
                    href="/hr/risks"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">radar</span>
                    <span className="font-label-md text-label-md">Risk & Retention Radar</span>
                  </Link>
                  <Link
                    href="/hr/policies"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">policy</span>
                    <span className="font-label-md text-label-md">Policy Intelligence</span>
                  </Link>
                  <Link
                    href="/jobs"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">work</span>
                    <span className="font-label-md text-label-md">Manage Jobs</span>
                  </Link>
                  <Link
                    href="/recruiter/create-job"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">add_box</span>
                    <span className="font-label-md text-label-md">Create Job</span>
                  </Link>
                  <Link
                    href="/applications"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined">fact_check</span>
                    <span className="font-label-md text-label-md">All Applications</span>
                  </Link>
                </>
              )}
              <Link
                href="/profile"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-3 px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined">person</span>
                <span className="font-label-md text-label-md">Profile</span>
              </Link>
            </nav>
            <div className="pt-xl border-t border-outline-variant space-y-1">
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-md py-sm text-on-surface-variant hover:bg-surface-container-low rounded-lg text-left"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-label-md text-label-md">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
