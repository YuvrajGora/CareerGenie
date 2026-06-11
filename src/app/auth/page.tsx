'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const signupParam = searchParams.get('signup');

  const { login, register, user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'student' | 'recruiter'>('student');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setIsSignUp(signupParam === 'true');
  }, [signupParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (isSignUp) {
      if (!name.trim()) {
        setError('Full Name is required.');
        setSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setSubmitting(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setSubmitting(false);
        return;
      }

      const result = await register({
        name,
        email,
        password,
        role,
      });

      if (!result.success) {
        setError(result.error || 'An error occurred during registration.');
      }
    } else {
      const result = await login({
        email,
        password,
      });

      if (!result.success) {
        setError(result.error || 'Invalid email or password.');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex">
      {/* Left Section: Visual/Illustration (Hero Content) */}
      <section className="hidden lg:flex lg:w-1/2 relative bg-primary overflow-hidden items-center justify-center p-2xl">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="relative z-10 max-w-[32rem] text-white text-center">
          <div className="mb-xl inline-flex items-center gap-sm bg-white/10 px-md py-xs rounded-full border border-white/20 backdrop-blur-sm">
            <span className="material-symbols-outlined text-sm font-fill">auto_awesome</span>
            <span className="font-label-md text-label-md">Next-Gen Career Intelligence</span>
          </div>
          <h1 className="font-display-lg text-display-lg mb-md tracking-tight leading-tight font-black">
            Your Personal AI <br /> Career Architect.
          </h1>
          <p className="font-body-lg text-body-lg opacity-90 mb-2xl">
            Connect with high-growth opportunities, optimize your profile with neural matching, and unlock your true professional potential.
          </p>

          <div className="relative w-full max-w-[28rem] mx-auto aspect-square">
            <div className="absolute inset-0 bg-white/5 rounded-3xl border border-white/10 blur-xl"></div>
            <div className="relative bg-white/10 border border-white/20 rounded-3xl p-lg backdrop-blur-md shadow-2xl animate-float">
              <div className="w-full h-64 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 relative overflow-hidden">
                <span className="material-symbols-outlined text-white text-6xl opacity-30">psychology</span>
                <div className="absolute bottom-4 left-4 right-4 bg-white/20 backdrop-blur-md p-sm rounded-lg text-left border border-white/10">
                  <p className="text-white text-xs font-bold">Matching Algorithm V2</p>
                  <p className="text-white/80 text-[10px]">Processing candidate suitability...</p>
                </div>
              </div>

              {/* Floating micro-elements */}
              <div className="absolute -top-4 -right-4 bg-white p-sm rounded-xl shadow-lg flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary font-bold">verified</span>
                <span className="text-on-surface font-label-md text-label-md font-bold">98% Match Rate</span>
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white p-sm rounded-xl shadow-lg flex items-center gap-sm text-left">
                <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-container text-sm">work</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-on-surface font-label-md text-label-md font-bold leading-none">Product Designer</span>
                  <span className="text-outline text-label-sm mt-0.5">San Francisco, CA</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-xl left-xl right-xl flex justify-between items-center text-white/60 font-label-sm text-label-sm">
          <span>© 2026 CareerGenie AI</span>
          <div className="flex gap-md">
            <a className="hover:text-white transition-colors" href="#">Privacy</a>
            <a className="hover:text-white transition-colors" href="#">Terms</a>
          </div>
        </div>
      </section>

      {/* Right Section: Login/Signup Forms */}
      <section className="w-full lg:w-1/2 flex flex-col bg-surface overflow-y-auto px-margin-mobile md:px-margin-desktop py-xl justify-between">
        {/* Mobile Top Logo */}
        <div className="lg:hidden flex justify-center mb-xl">
          <Link href="/">
            <span className="font-headline-xl text-headline-xl font-black text-primary">CareerGenie</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[420px] py-md">
            {/* Form Header */}
            <div className="mb-xl text-center lg:text-left">
              <Link href="/">
                <span className="hidden lg:block font-headline-xl text-headline-xl font-black text-primary mb-xl cursor-pointer">
                  CareerGenie
                </span>
              </Link>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs font-bold">
                {isSignUp ? 'Create an account' : 'Welcome back'}
              </h2>
              <p className="text-on-surface-variant font-body-md text-body-md">
                {isSignUp
                  ? 'Join the next generation of recruitment intelligence.'
                  : 'Please enter your details to sign in.'}
              </p>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="mb-lg p-md bg-error-container text-error rounded-lg text-body-sm font-semibold flex items-center gap-sm">
                <span className="material-symbols-outlined text-md">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-md">
              {/* Role Selection (Only for SignUp) */}
              {isSignUp && (
                <div className="space-y-sm">
                  <label className="block font-label-md text-label-md text-on-surface font-bold">Register as a</label>
                  <div className="grid grid-cols-2 gap-sm">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`flex items-center justify-center gap-sm p-sm border-2 rounded-xl transition-all ${
                        role === 'student'
                          ? 'border-primary bg-primary/5 text-primary font-bold'
                          : 'border-outline-variant hover:border-primary/50 text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined">school</span>
                      <span className="font-label-md text-label-md">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('recruiter')}
                      className={`flex items-center justify-center gap-sm p-sm border-2 rounded-xl transition-all ${
                        role === 'recruiter'
                          ? 'border-primary bg-primary/5 text-primary font-bold'
                          : 'border-outline-variant hover:border-primary/50 text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined">business_center</span>
                      <span className="font-label-md text-label-md">Recruiter</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Fields */}
              {isSignUp && (
                <div className="space-y-xs">
                  <label className="block font-label-md text-label-md text-on-surface font-bold">Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-[48px] px-md rounded-lg border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none bg-surface-container-lowest text-on-surface"
                    placeholder="John Doe"
                    type="text"
                  />
                </div>
              )}

              <div className="space-y-xs">
                <label className="block font-label-md text-label-md text-on-surface font-bold">Email Address</label>
                <input
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[48px] px-md rounded-lg border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none bg-surface-container-lowest text-on-surface"
                  placeholder="name@company.com"
                  type="email"
                />
              </div>

              <div className="space-y-xs">
                <div className="flex justify-between items-center">
                  <label className="block font-label-md text-label-md text-on-surface font-bold">Password</label>
                  {!isSignUp && (
                    <a className="text-primary font-label-sm text-label-sm hover:underline" href="#">
                      Forgot password?
                    </a>
                  )}
                </div>
                <input
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[48px] px-md rounded-lg border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none bg-surface-container-lowest text-on-surface"
                  placeholder="••••••••"
                  type="password"
                />
              </div>

              {isSignUp && (
                <div className="space-y-xs">
                  <label className="block font-label-md text-label-md text-on-surface font-bold">Confirm Password</label>
                  <input
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-[48px] px-md rounded-lg border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none bg-surface-container-lowest text-on-surface"
                    placeholder="••••••••"
                    type="password"
                  />
                </div>
              )}

              {!isSignUp && (
                <div className="flex items-center gap-sm pt-xs">
                  <input
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                    id="remember"
                    type="checkbox"
                  />
                  <label className="font-body-sm text-body-sm text-on-surface-variant font-medium" htmlFor="remember">
                    Remember for 30 days
                  </label>
                </div>
              )}

              <button
                disabled={submitting}
                className="w-full h-[48px] bg-primary text-white rounded-lg font-label-md text-label-md hover:brightness-110 shadow-sm active:scale-95 disabled:opacity-50 transition-all font-bold flex items-center justify-center gap-sm"
                type="submit"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            {/* Toggle Action */}
            <p className="mt-xl text-center font-body-sm text-body-sm text-on-surface-variant font-medium">
              {isSignUp ? 'Already have an account?' : 'New to CareerGenie?'}
              <button
                onClick={() => {
                  setError(null);
                  setIsSignUp(!isSignUp);
                }}
                className="text-primary font-label-md hover:underline font-bold ml-1"
              >
                {isSignUp ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer for forms */}
        <div className="mt-xl pt-xl border-t border-outline-variant flex flex-col items-center gap-md">
          <div className="flex gap-xl font-label-sm text-label-sm text-on-surface-variant font-bold">
            <a className="hover:text-primary transition-colors" href="#">Help Center</a>
            <a className="hover:text-primary transition-colors" href="#">Privacy</a>
            <a className="hover:text-primary transition-colors" href="#">Terms</a>
          </div>
          <span className="font-label-sm text-label-sm text-outline">© 2026 CareerGenie AI</span>
        </div>
      </section>
    </div>
  );
}

export default function AuthPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
      </div>
    }>
      <AuthPageContent />
    </React.Suspense>
  );
}
