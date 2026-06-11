'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function CreateJobPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form states
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [requiredSkillsString, setRequiredSkillsString] = useState('');
  const [experience, setExperience] = useState<number>(0);
  const [salaryMin, setSalaryMin] = useState<number>(0);
  const [salaryMax, setSalaryMax] = useState<number>(0);
  const [location, setLocation] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'recruiter' && user.role !== 'admin'))) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const requiredSkills = requiredSkillsString
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (requiredSkills.length === 0) {
      setErrorMsg('At least one required skill must be specified.');
      setLoading(false);
      return;
    }

    if (salaryMax < salaryMin) {
      setErrorMsg('Maximum salary cannot be less than minimum salary.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          company,
          description,
          requiredSkills,
          experience: Number(experience),
          salaryMin: Number(salaryMin),
          salaryMax: Number(salaryMax),
          location,
        }),
      });

      if (res.ok) {
        setSuccessMsg('Job posting created successfully!');
        // Clear form
        setTitle('');
        setCompany('');
        setDescription('');
        setRequiredSkillsString('');
        setExperience(0);
        setSalaryMin(0);
        setSalaryMax(0);
        setLocation('');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to create job posting.');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="mt-24 max-w-[42rem] mx-auto px-lg pb-3xl text-left">
      <div className="mb-xl">
        <h2 className="font-headline-lg text-headline-lg text-primary font-black">Post a New Job</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Fill out the details below to publish a new job posting for AI matching and applications.
        </p>
      </div>

      {successMsg && (
        <div className="p-md bg-primary-container text-primary rounded-xl text-body-sm font-bold flex items-center gap-sm mb-lg">
          <span className="material-symbols-outlined text-md">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-md bg-error-container text-error rounded-xl text-body-sm font-bold flex items-center gap-sm mb-lg">
          <span className="material-symbols-outlined text-md">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm space-y-md">
        <div className="grid md:grid-cols-2 gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Job Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
              type="text"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Company Name</label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. CareerGenie AI"
              className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
              type="text"
            />
          </div>
        </div>

        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Job Description</label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe role responsibilities, ideal candidate traits, and project context..."
            className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Job Location</label>
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, CA or Remote"
              className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
              type="text"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Required Experience (Years)</label>
            <input
              required
              min={0}
              value={experience}
              onChange={(e) => setExperience(Math.max(0, parseInt(e.target.value) || 0))}
              className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
              type="number"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Minimum Salary ($ / Year)</label>
            <input
              required
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(Math.max(0, parseInt(e.target.value) || 0))}
              className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
              type="number"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Maximum Salary ($ / Year)</label>
            <input
              required
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(Math.max(0, parseInt(e.target.value) || 0))}
              className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
              type="number"
            />
          </div>
        </div>

        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant font-bold">Required Skills (comma separated)</label>
          <input
            required
            value={requiredSkillsString}
            onChange={(e) => setRequiredSkillsString(e.target.value)}
            placeholder="React, Node.js, AWS, Kubernetes"
            className="px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
            type="text"
          />
        </div>

        <div className="flex gap-md pt-md">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-sm bg-surface border border-outline-variant hover:bg-surface-container-low text-on-surface rounded-lg font-label-md text-label-md transition-all font-bold text-center"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            type="submit"
            className="flex-1 py-sm bg-primary text-white hover:brightness-110 active:scale-95 text-center rounded-lg font-label-md text-label-md transition-all font-bold"
          >
            {loading ? 'Creating Job...' : 'Create Posting'}
          </button>
        </div>
      </form>
    </div>
  );
}
