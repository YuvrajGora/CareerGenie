'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant shadow-sm transition-colors">
        <div className="flex justify-between items-center px-lg py-sm max-w-max-width mx-auto w-full">
          <div className="flex items-center space-x-xl">
            <Link href="/" className="font-headline-lg text-headline-lg font-black text-primary">
              CareerGenie
            </Link>
            <div className="hidden md:flex space-x-lg">
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#how-it-works">Explore</a>
              <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href={user ? "/jobs" : "/auth"}>Jobs</Link>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#testimonials">Network</a>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#ai-features">Insights</a>
            </div>
          </div>
          <div className="flex items-center space-x-md">
            {user ? (
              <Link href="/dashboard" className="px-lg py-sm bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/auth" className="font-label-md text-label-md text-primary hover:underline px-md py-sm">
                  Sign In
                </Link>
                <Link href="/auth?signup=true" className="px-lg py-sm bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-32 pb-2xl hero-gradient overflow-hidden flex-shrink-0">
        <div className="max-w-max-width mx-auto px-lg grid md:grid-cols-2 gap-2xl items-center">
          <div className="space-y-xl">
            <div className="inline-flex items-center px-md py-xs bg-primary-container/20 text-primary rounded-full space-x-sm">
              <span className="material-symbols-outlined text-sm font-fill">auto_awesome</span>
              <span className="font-label-md text-label-md font-semibold">Next-Gen Recruitment AI</span>
            </div>
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg leading-tight font-black text-on-surface">
              Land Your Dream Job with <span className="text-primary">AI-Powered</span> Career Guidance
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[36rem]">
              Optimize your resume, discover perfect matches, and track your applications with the world's most advanced AI career companion.
            </p>
            <div className="flex flex-col sm:flex-row gap-md pt-md">
              <Link href={user ? "/resume" : "/auth"} className="px-xl py-md bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm text-center hover:brightness-110 active:scale-95 transition-all">
                Analyze Resume
              </Link>
              <Link href={user ? "/jobs" : "/auth"} className="px-xl py-md bg-white border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg text-center hover:bg-surface-container-low transition-all">
                Explore Jobs
              </Link>
            </div>
          </div>

          {/* Hero Illustration (Bento Style Preview) */}
          <div className="relative">
            <div className="grid grid-cols-6 grid-rows-6 gap-sm h-[420px]">
              <div className="col-span-4 row-span-4 glass-card rounded-xl p-md shadow-lg overflow-hidden flex flex-col relative">
                <div className="flex items-center justify-between mb-md border-b border-outline-variant pb-sm">
                  <span className="font-label-md text-label-md font-bold text-on-surface">Resume Score</span>
                  <span className="text-primary font-black">89%</span>
                </div>
                <div className="flex-1 bg-surface-container-low rounded-lg p-sm border border-outline-variant flex flex-col justify-between">
                  <div className="space-y-xs">
                    <div className="h-2 w-3/4 bg-outline-variant rounded"></div>
                    <div className="h-2 w-1/2 bg-outline-variant rounded"></div>
                    <div className="h-2 w-5/6 bg-outline-variant rounded"></div>
                  </div>
                  <div className="h-2 w-1/3 bg-outline-variant rounded"></div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white to-transparent"></div>
                <div className="absolute bottom-md left-md right-md bg-primary-container text-white p-sm rounded-lg text-xs font-semibold shadow-md">
                  AI Tip: Add more &quot;quantifiable results&quot; to your experience section.
                </div>
              </div>

              <div className="col-span-2 row-span-3 glass-card rounded-xl p-sm shadow-md flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 mb-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">psychology</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Matching AI</span>
                <span className="font-headline-lg text-headline-lg font-black text-primary">95%</span>
              </div>

              <div className="col-span-2 row-span-3 glass-card rounded-xl p-sm shadow-md flex items-center justify-center space-x-sm">
                <div className="w-8 h-8 bg-secondary-container rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-container text-md">work</span>
                </div>
                <div className="min-w-0">
                  <p className="font-label-sm text-label-sm font-bold truncate">Senior Designer</p>
                  <p className="text-[10px] text-on-surface-variant truncate">Stripe • Remote</p>
                </div>
              </div>

              <div className="col-span-4 row-span-2 glass-card rounded-xl p-md shadow-md flex flex-col justify-center space-y-sm">
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant font-bold">
                  <span>Market Alignment</span>
                  <span className="text-primary">High Match</span>
                </div>
                <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[75%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Statistics Section */}
      <section className="py-2xl bg-white border-y border-outline-variant">
        <div className="max-w-max-width mx-auto px-lg grid grid-cols-2 md:grid-cols-4 gap-xl">
          <div className="text-center">
            <h3 className="font-display-lg text-display-lg-mobile text-primary font-black">500k+</h3>
            <p className="font-label-md text-label-md text-on-surface-variant font-medium">Active Candidates</p>
          </div>
          <div className="text-center">
            <h3 className="font-display-lg text-display-lg-mobile text-primary font-black">95%</h3>
            <p className="font-label-md text-label-md text-on-surface-variant font-medium">Match Accuracy</p>
          </div>
          <div className="text-center">
            <h3 className="font-display-lg text-display-lg-mobile text-primary font-black">12k+</h3>
            <p className="font-label-md text-label-md text-on-surface-variant font-medium">Partner Companies</p>
          </div>
          <div className="text-center">
            <h3 className="font-display-lg text-display-lg-mobile text-primary font-black">40%</h3>
            <p className="font-label-md text-label-md text-on-surface-variant font-medium">Faster Hiring</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-3xl bg-surface-container-lowest">
        <div className="max-w-max-width mx-auto px-lg">
          <div className="text-center mb-3xl space-y-md">
            <h2 className="font-headline-xl text-headline-xl font-bold">Your Path to Career Success</h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-[42rem] mx-auto">
              Our streamlined process combines human aspiration with artificial intelligence to get you exactly where you want to be.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-xl">
            <div className="group p-xl rounded-xl border border-outline-variant bg-white hover:border-primary transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">upload_file</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg mb-md font-bold">Upload &amp; Sync</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Upload your resume PDF. Our AI instantly parses and extracts your unique skillset.
              </p>
            </div>
            <div className="group p-xl rounded-xl border border-outline-variant bg-white hover:border-primary transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">insights</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg mb-md font-bold">AI Optimization</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Receive deep insights into how your profile compares to market demands and get actionable advice to improve.
              </p>
            </div>
            <div className="group p-xl rounded-xl border border-outline-variant bg-white hover:border-primary transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg mb-md font-bold">Perfect Matching</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Get matched with roles that actually fit your career trajectory, skills compatibility, and resume profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Feature: AI Resume Feedback */}
      <section id="ai-features" className="py-3xl overflow-hidden bg-white">
        <div className="max-w-max-width mx-auto px-lg">
          <div className="grid md:grid-cols-2 gap-3xl items-center">
            <div className="relative order-2 md:order-1">
              <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
              <div className="relative glass-card rounded-2xl p-xl shadow-xl border border-outline-variant bg-white/80">
                <div className="space-y-lg">
                  <div className="flex items-start space-x-md">
                    <div className="w-8 h-8 rounded-full bg-error-container text-error flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm font-bold">close</span>
                    </div>
                    <div>
                      <p className="font-label-md text-label-md line-through opacity-50 text-on-surface">Handled various project management tasks.</p>
                      <p className="text-xs text-error font-semibold mt-xs">Generic phrasing detected.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-md">
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm font-bold">check</span>
                    </div>
                    <div className="bg-surface-container p-md rounded-lg border-l-4 border-primary flex-1">
                      <p className="font-label-md text-label-md font-bold text-on-surface">Spearheaded 12+ cross-functional projects resulting in a 20% increase in operational efficiency.</p>
                      <p className="text-xs text-primary font-semibold mt-xs">Quantifiable impact added. High recruiter appeal.</p>
                    </div>
                  </div>
                  <div className="pt-md border-t border-outline-variant flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Analysis Engine V4.0</span>
                    <span className="px-sm py-1 bg-primary text-white text-[10px] rounded uppercase font-bold">AI Active</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-xl order-1 md:order-2">
              <h2 className="font-headline-xl text-headline-xl font-bold">AI Resume Feedback</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                Don&apos;t let your resume get lost in the ATS void. Our AI analyzes your document against thousands of successful hires to give you the competitive edge.
              </p>
              <ul className="space-y-md">
                <li className="flex items-center space-x-md">
                  <span className="material-symbols-outlined text-primary text-xl font-bold">task_alt</span>
                  <span className="font-body-md text-body-md font-medium">Keyword optimization for specific job roles</span>
                </li>
                <li className="flex items-center space-x-md">
                  <span className="material-symbols-outlined text-primary text-xl font-bold">task_alt</span>
                  <span className="font-body-md text-body-md font-medium">Tone and impact score analysis</span>
                </li>
                <li className="flex items-center space-x-md">
                  <span className="material-symbols-outlined text-primary text-xl font-bold">task_alt</span>
                  <span className="font-body-md text-body-md font-medium">Real-time suggestions for better phrasing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-3xl bg-surface-container-low border-t border-outline-variant">
        <div className="max-w-max-width mx-auto px-lg">
          <h2 className="font-headline-xl text-headline-xl text-center mb-2xl font-bold">Success Stories</h2>
          <div className="grid md:grid-cols-3 gap-xl">
            <div className="glass-card p-xl rounded-xl space-y-md bg-white">
              <div className="flex text-tertiary">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined font-fill text-lg">star</span>
                ))}
              </div>
              <p className="font-body-md text-body-md italic text-on-surface-variant leading-relaxed">
                &quot;CareerGenie completely changed my approach to job hunting. The AI resume feedback helped me land interviews at three Fortune 500 companies within a month.&quot;
              </p>
              <div className="flex items-center space-x-md pt-md border-t border-outline-variant">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md font-bold">Sarah Jenkins</p>
                  <p className="text-xs text-on-surface-variant">Product Designer at Google</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-xl rounded-xl space-y-md bg-white">
              <div className="flex text-tertiary">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined font-fill text-lg">star</span>
                ))}
              </div>
              <p className="font-body-md text-body-md italic text-on-surface-variant leading-relaxed">
                &quot;The job matching algorithm is scarily accurate. It found roles I didn&apos;t even know I was qualified for, and now I&apos;m making 30% more than my last role.&quot;
              </p>
              <div className="flex items-center space-x-md pt-md border-t border-outline-variant">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md font-bold">Marcus Chen</p>
                  <p className="text-xs text-on-surface-variant">Senior Engineer at Vercel</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-xl rounded-xl space-y-md bg-white">
              <div className="flex text-tertiary">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined font-fill text-lg">star</span>
                ))}
              </div>
              <p className="font-body-md text-body-md italic text-on-surface-variant leading-relaxed">
                &quot;Tracking applications used to be a nightmare of spreadsheets. CareerGenie&apos;s dashboard keeps everything in one place. I&apos;ve never felt so organized.&quot;
              </p>
              <div className="flex items-center space-x-md pt-md border-t border-outline-variant">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md font-bold">Aisha Rahman</p>
                  <p className="text-xs text-on-surface-variant">Marketing Lead at Figma</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-3xl relative overflow-hidden bg-primary/5 border-t border-outline-variant text-center">
        <div className="max-w-max-width mx-auto px-lg space-y-xl relative z-10">
          <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg font-black text-on-surface">Ready to transform your career?</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[42rem] mx-auto">
            Join 500,000+ professionals who are using CareerGenie to navigate their career path with confidence.
          </p>
          <div className="flex justify-center pt-md">
            <Link href={user ? "/dashboard" : "/auth?signup=true"} className="px-2xl py-md bg-primary text-white font-label-md text-label-md rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all text-center">
              Get Started for Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface border-t border-outline-variant py-xl px-lg mt-auto">
        <div className="max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-xl">
          <div className="space-y-md">
            <span className="font-headline-md text-headline-md font-black text-primary">CareerGenie</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[20rem] leading-relaxed">
              AI-powered recruitment and career guidance for the modern professional.
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant opacity-60">
              © 2026 CareerGenie AI. All rights reserved.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-xl">
            <div className="flex flex-col space-y-sm">
              <span className="font-label-md text-label-md font-bold">Product</span>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Resume AI</a>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Job Search</a>
            </div>
            <div className="flex flex-col space-y-sm">
              <span className="font-label-md text-label-md font-bold">Company</span>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">About Us</a>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Careers</a>
            </div>
            <div className="flex flex-col space-y-sm">
              <span className="font-label-md text-label-md font-bold">Legal</span>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Terms</a>
            </div>
            <div className="flex flex-col space-y-sm">
              <span className="font-label-md text-label-md font-bold">Connect</span>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">LinkedIn</a>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
