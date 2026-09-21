'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface Job {
  _id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  requiredSkills: string[];
  salaryRange?: string;
  description: string;
  logoUrl?: string;
  createdAt: string;
}

export default function JobDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [match, setMatch] = useState<{
    matchScore: number;
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
  } | null>(null);

  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
        setMatch(data.match);
      }
    } catch (err) {
      console.error('Error fetching job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!job) return;
    if (!user) {
      alert('Please sign in as a student to apply for jobs.');
      router.push('/auth');
      return;
    }
    if (user.role !== 'student') {
      alert('Only student accounts can submit job applications.');
      return;
    }
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job._id }),
      });
      if (res.ok) {
        setApplied(true);
        alert('Application submitted successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit application.');
      }
    } catch (err) {
      alert('Error submitting application.');
    }
  };

  if (loading) {
    return (
      <div className="pt-32 pb-12 flex justify-center">
        <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="pt-32 pb-12 text-center text-on-surface-variant">
        <h2 className="text-xl font-bold">Job Listing Not Found</h2>
        <Link href="/jobs" className="text-primary hover:underline mt-md inline-block font-bold">
          Return to Jobs search
        </Link>
      </div>
    );
  }


  return (
    <main className="pt-24 pb-2xl max-w-max-width mx-auto px-md md:px-lg grid grid-cols-1 lg:grid-cols-12 gap-lg text-left">
      {/* Job Header & Description (Left Column) */}
      <div className="lg:col-span-8 space-y-lg">
        {/* Back Action */}
        <button
          onClick={() => router.push('/jobs')}
          className="flex items-center gap-xs text-primary font-label-md text-label-md hover:translate-x-[-4px] transition-transform font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Search
        </button>

        {/* Company Info & Title */}
        <section className="bg-surface-container-lowest border border-outline-variant p-xl rounded-xl">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-md">
            <div className="flex gap-md items-start">
              <div className="w-16 h-16 rounded-lg bg-surface-container flex items-center justify-center border border-outline-variant shrink-0">
                {job.logoUrl ? (
                  <img alt={job.company} className="w-10 h-10 object-contain" src={job.logoUrl} />
                ) : (
                  <span className="material-symbols-outlined text-outline text-3xl">work</span>
                )}
              </div>
              <div>
                <h1 className="font-headline-xl text-headline-xl text-on-surface mb-xs font-bold leading-tight">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-sm text-on-surface-variant font-body-md text-body-md">
                  <span className="font-bold text-primary">{job.company}</span>
                  <span className="w-1 h-1 bg-outline rounded-full"></span>
                  <span className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                    {job.location}
                  </span>
                  <span className="w-1 h-1 bg-outline rounded-full"></span>
                  <span className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="bg-surface border border-outline-variant text-on-surface px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors active:scale-95 font-bold">
                Save Job
              </button>
              <button
                disabled={applied}
                onClick={handleApply}
                className="bg-primary text-white px-lg py-sm rounded-lg font-label-md text-label-md shadow-md hover:brightness-110 transition-all active:scale-95 font-bold disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:cursor-not-allowed"
              >
                {applied ? 'Applied' : 'Apply Now'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md mt-xl pt-xl border-t border-outline-variant">
            <div className="space-y-xs">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase font-bold">Salary Range</p>
              <p className="font-label-md text-label-md text-on-surface font-bold">{job.salaryRange || '$140k - $180k'}</p>
            </div>
            <div className="space-y-xs">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase font-bold">Job Type</p>
              <p className="font-label-md text-label-md text-on-surface font-bold">{job.type}</p>
            </div>
            <div className="space-y-xs">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase font-bold">Experience</p>
              <p className="font-label-md text-label-md text-on-surface font-bold">Mid-Senior</p>
            </div>
            <div className="space-y-xs">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase font-bold">Team Size</p>
              <p className="font-label-md text-label-md text-on-surface font-bold">10+ Members</p>
            </div>
          </div>
        </section>

        {/* Job Description */}
        <section className="bg-surface-container-lowest border border-outline-variant p-xl rounded-xl space-y-md">
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Job Description</h2>
          <div className="prose prose-slate max-w-none text-on-surface-variant font-body-md text-body-md leading-relaxed space-y-md whitespace-pre-line">
            {job.description}
          </div>
        </section>

        {/* Required Skills (Bento Style) */}
        <section className="space-y-md">
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Required Skills</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {job.requiredSkills.map((skill, index) => (
              <div
                key={index}
                className="p-md bg-secondary-container/10 border border-secondary-container/20 rounded-lg flex flex-col items-center justify-center text-center"
              >
                <span className="material-symbols-outlined text-secondary mb-xs">terminal</span>
                <span className="font-label-md text-label-md text-on-surface font-bold">{skill}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Sidebar (Right Column) */}
      <aside className="lg:col-span-4 space-y-lg">
        {/* AI Match Breakdown Widget */}
        {!match ? (
          <section className="bg-surface-container-lowest border border-outline-variant p-xl rounded-xl relative overflow-hidden text-center">
            <div className="flex flex-col items-center gap-md py-md">
              <span className="material-symbols-outlined text-4xl text-outline">psychology_alt</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">AI Match Score</h3>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Log in as a student and complete your profile/resume to view your personalized AI Match Score for this job.
              </p>
              <Link
                href="/login"
                className="mt-xs bg-primary text-white px-md py-sm rounded-lg font-label-md text-label-md hover:brightness-110 transition-all font-bold inline-block"
              >
                Log In / Complete Profile
              </Link>
            </div>
          </section>
        ) : (
          <section className="bg-surface-container-lowest border border-outline-variant p-xl rounded-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 blur-3xl rounded-full"></div>
            <div className="relative">
              <div className="flex items-center gap-sm mb-lg">
                <div className="p-xs bg-primary/10 rounded-lg text-primary">
                  <span className="material-symbols-outlined">psychology</span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-primary font-bold">AI Match Score</h3>
              </div>
              <div className="flex flex-col items-center mb-xl">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-surface-container" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                    <circle
                      className="text-primary transition-all duration-1000 ease-out"
                      cx="64"
                      cy="64"
                      fill="transparent"
                      r="58"
                      stroke="currentColor"
                      strokeDasharray="364.4"
                      strokeDashoffset={364.4 - (364.4 * match.matchScore) / 100}
                      strokeWidth="8"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-headline-xl font-black text-on-surface">{match.matchScore}%</span>
                    <span className="text-label-sm text-on-surface-variant uppercase font-bold">
                      {match.matchScore >= 85 ? 'Excellent' : match.matchScore >= 70 ? 'Good' : match.matchScore >= 50 ? 'Fair' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-md">
                <div className="space-y-xs">
                  <div className="flex justify-between font-label-md text-label-md font-semibold">
                    <span className="text-on-surface">Skills Match</span>
                    <span className="text-primary">{match.skillsMatch}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${match.skillsMatch}%` }}></div>
                  </div>
                </div>
                <div className="space-y-xs">
                  <div className="flex justify-between font-label-md text-label-md font-semibold">
                    <span className="text-on-surface">Experience</span>
                    <span className="text-primary">{match.experienceMatch}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${match.experienceMatch}%` }}></div>
                  </div>
                </div>
                <div className="space-y-xs">
                  <div className="flex justify-between font-label-md text-label-md font-semibold">
                    <span className="text-on-surface">Education</span>
                    <span className="text-primary">{match.educationMatch}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${match.educationMatch}%` }}></div>
                  </div>
                </div>
              </div>
              <div className="mt-xl p-md bg-surface-container-low rounded-lg border border-outline-variant/50">
                <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                  {match.matchScore >= 80
                    ? '"Excellent match! You exceed the requirements. Focus your application on your technical and distributed environments experience."'
                    : match.matchScore >= 60
                    ? '"Good match. You meet key requirements. Highlight relevant skills and project experiences to stand out."'
                    : '"Fair match. You may need to bolster some skills or experience. Highlight transferrable skills and continuous learning."'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Company Quick Stats */}
        <section className="bg-surface-container-lowest border border-outline-variant p-xl rounded-xl space-y-md">
          <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
            About {job.company}
          </h3>
          <div className="space-y-sm">
            <div className="flex items-center gap-sm text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[20px]">public</span>
              <span>www.{job.company.toLowerCase().replace(/\s/g, '')}.com</span>
            </div>
            <div className="flex items-center gap-sm text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[20px]">groups</span>
              <span>5,000+ employees</span>
            </div>
            <div className="flex items-center gap-sm text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[20px]">domain</span>
              <span>FinTech / Technology Services</span>
            </div>
          </div>
        </section>
      </aside>
    </main>
  );
}
