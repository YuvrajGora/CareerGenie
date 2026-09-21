'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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
  description: string;
}

export default function JobsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Search parameters
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [salary, setSalary] = useState(120); // range baseline
  const [experience, setExperience] = useState<'Entry' | 'Mid' | 'Senior'>('Entry');

  // Trigger loading
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const skillsQuery = selectedSkills.join(',');
      const res = await fetch(`/api/jobs?q=${search}&location=${location}&skills=${skillsQuery}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load matching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [search, location, selectedSkills]);

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleApply = async (jobId: string) => {
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
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) {
        alert('Application submitted successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit application.');
      }
    } catch (err) {
      alert('Error submitting application. Please try again.');
    }
  };

  return (
    <div className="pt-24 pb-12 px-md lg:px-lg max-w-max-width mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter text-left">
        {/* Left: Filters Sidebar */}
        <aside className="lg:col-span-3 space-y-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm sticky top-24">
            <div className="flex justify-between items-center mb-md">
              <h2 className="font-label-md text-label-md text-on-surface font-bold">Filter Jobs</h2>
              <button
                onClick={() => {
                  setSearch('');
                  setLocation('');
                  setSelectedSkills([]);
                  setSalary(120);
                }}
                className="text-primary font-label-sm text-label-sm hover:underline font-bold"
              >
                Reset
              </button>
            </div>

            {/* Filter Section: Skills */}
            <div className="mb-xl">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm font-bold">Skills</h3>
              <div className="space-y-sm">
                {['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Figma'].map((skill) => (
                  <label key={skill} className="flex items-center gap-sm cursor-pointer group">
                    <input
                      checked={selectedSkills.includes(skill)}
                      onChange={() => handleSkillToggle(skill)}
                      className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                      type="checkbox"
                    />
                    <span className="text-body-sm text-on-surface-variant group-hover:text-on-surface font-medium">
                      {skill}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter Section: Location */}
            <div className="mb-xl">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm font-bold">Location</h3>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full h-10 border border-outline-variant rounded-lg px-sm text-body-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-surface-container-lowest text-on-surface font-semibold"
              >
                <option value="">Any Location</option>
                <option value="San Francisco, CA">San Francisco, CA</option>
                <option value="Remote">Remote</option>
                <option value="New York, NY">New York, NY</option>
                <option value="Austin, TX">Austin, TX</option>
              </select>
            </div>

            {/* Filter Section: Salary */}
            <div className="mb-xl">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm font-bold">
                Salary Target
              </h3>
              <input
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
                max="300"
                min="50"
                step="10"
                type="range"
              />
              <div className="flex justify-between mt-sm text-xs text-outline font-semibold">
                <span>$50k</span>
                <span className="text-primary font-bold">${salary}k+</span>
                <span>$300k+</span>
              </div>
            </div>

            {/* Filter Section: Experience */}
            <div className="mb-md">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm font-bold">
                Experience Level
              </h3>
              <div className="flex flex-wrap gap-xs">
                {['Entry', 'Mid', 'Senior'].map((exp) => (
                  <button
                    key={exp}
                    onClick={() => setExperience(exp as any)}
                    className={`px-sm py-xs rounded-full font-label-sm text-label-sm font-semibold transition-all ${
                      experience === exp
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-outline-variant'
                    }`}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Job Cards Container */}
        <div className="lg:col-span-9 space-y-md">
          {/* Top Search Bar */}
          <div className="relative w-full max-w-xl mb-lg">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-body-sm font-semibold text-on-surface"
              placeholder="Search by job title, company, or keyword..."
              type="text"
            />
          </div>

          <div className="flex justify-between items-center mb-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Matching Job Listings
              <span className="text-outline text-body-md font-normal ml-sm">({jobs.length} matches)</span>
            </h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-2xl">
              <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : (
            <div className="space-y-md">
              {jobs.length === 0 ? (
                <div className="bg-white border border-outline-variant rounded-xl p-2xl text-center text-on-surface-variant font-body-md">
                  No active job listings match your current filters.
                </div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job._id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg hover:border-primary hover:shadow-md transition-all relative overflow-hidden"
                  >
                    {/* AI Highlight Match tag */}
                    {job.matchScore !== undefined && job.matchScore !== null && (
                      <div className={`absolute top-0 right-0 px-md py-1 rounded-bl-xl flex items-center gap-xs shadow-md ${
                        job.matchScore > 80 ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant border-l border-b border-outline-variant'
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">psychology</span>
                        <span className="font-label-sm text-label-sm font-bold">
                          {job.matchScore}% Match {job.matchScore > 80 ? 'AI Recommended' : ''}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-lg">
                      <div className="w-16 h-16 rounded-xl border border-outline-variant flex items-center justify-center p-sm bg-white shrink-0">
                        {job.logoUrl ? (
                          <img alt={job.company} className="w-10 h-10 object-contain" src={job.logoUrl} />
                        ) : (
                          <span className="material-symbols-outlined text-outline text-3xl">work</span>
                        )}
                      </div>

                      <div className="flex-grow">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
                          <div>
                            <Link href={`/jobs/${job._id}`}>
                              <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold hover:text-primary transition-colors cursor-pointer">
                                {job.title}
                              </h3>
                            </Link>
                            <p className="text-primary font-label-md text-label-md font-semibold mt-0.5">
                              {job.company} • <span className="text-on-surface-variant font-normal">{job.location}</span>
                            </p>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-on-surface font-headline-lg text-headline-lg font-bold">
                              {job.salaryRange || '$120k - $160k'}
                            </p>
                            <p className="text-on-surface-variant text-body-sm font-medium">Annual Base Salary</p>
                          </div>
                        </div>

                        {/* Skills Chips */}
                        <div className="mt-md flex flex-wrap gap-sm">
                          {job.requiredSkills.map((skill) => (
                            <span
                              key={skill}
                              className="bg-primary/10 text-primary px-sm py-1 rounded-full text-label-sm font-bold"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        {/* Card bottom actions */}
                        <div className="mt-xl flex flex-col md:flex-row md:items-center justify-between gap-md border-t border-outline-variant pt-md">
                          <p className="text-body-sm text-on-surface-variant font-medium">
                            Experience Required: {job.description.includes('Senior') ? 'Senior' : 'Mid/Entry'}
                          </p>
                          <div className="flex gap-sm">
                            <Link
                              href={`/jobs/${job._id}`}
                              className="px-xl py-sm rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors font-bold text-center"
                            >
                              View Details
                            </Link>
                            <button
                              onClick={() => handleApply(job._id)}
                              className="px-xl py-sm rounded-lg bg-primary text-white font-label-md text-label-md hover:brightness-110 active:scale-95 transition-all font-bold"
                            >
                              Apply Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
