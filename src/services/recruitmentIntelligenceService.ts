import mongoose from 'mongoose';
import User from '@/models/User';
import Job from '@/models/Job';
import Application from '@/models/Application';
import JobMatch from '@/models/JobMatch';
import Resume from '@/models/Resume';
import InterviewEvaluation from '@/models/InterviewEvaluation';
import { calculateDetailedMatchScore, estimateExperience } from '@/services/matching';

export interface CandidateRankingItem {
  candidateId: string;
  name: string;
  email: string;
  careerLevel: string;
  yearsOfExperience: number;
  education: string;
  profileImage?: string;
  applicationId?: string;
  applicationStatus: 'applied' | 'interviewing' | 'accepted' | 'rejected' | 'pool';
  appliedAt?: string;
  matchScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
  hasInterviewEvaluation: boolean;
  interviewRecommendation?: 'strong_hire' | 'hire' | 'borderline' | 'do_not_hire';
}

export interface CandidateRankingFilter {
  jobId: string;
  minScore?: number;
  status?: string;
  skillFilter?: string;
  search?: string;
  sortBy?: 'matchScore' | 'skillsMatch' | 'experienceMatch' | 'appliedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface RecruitmentSummaryStats {
  totalCandidates: number;
  strongMatches: number;
  inInterview: number;
  averageMatchScore: number;
}

/**
 * Validates recruiter authorization for the requested job.
 * Admin can access any job. Recruiters can only access jobs they own.
 * Throws an Error if unauthorized or job is not found.
 */
export async function verifyJobRecruiterAccess(jobId: string, recruiterId: string, userRole: string) {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error('Invalid Job ID format.');
  }

  const job = await Job.findById(jobId);
  if (!job) {
    throw new Error('Job posting not found.');
  }

  if (userRole !== 'admin') {
    if (job.recruiterId.toString() !== recruiterId.toString()) {
      throw new Error('Forbidden. You do not have permission to access candidates for this job.');
    }
  }

  return job;
}

/**
 * Aggregates, calculates missing JobMatches lazily, filters, and ranks candidates for a job.
 * Incorporates User + Job + Application + JobMatch + Resume + InterviewEvaluation.
 */
export async function getRankedCandidates(
  filter: CandidateRankingFilter,
  recruiterId: string,
  userRole: string
): Promise<{
  candidates: CandidateRankingItem[];
  summary: RecruitmentSummaryStats;
  job: {
    _id: string;
    title: string;
    company: string;
    requiredSkills: string[];
    experience: number;
    location: string;
    status: string;
  };
}> {
  const job = await verifyJobRecruiterAccess(filter.jobId, recruiterId, userRole);
  const targetJobId = job._id;

  // 1. Fetch direct applications for this job
  const applications = await Application.find({ jobId: targetJobId }).lean();
  const applicantUserIds = applications.map(app => app.studentId.toString());

  // 2. Fetch existing JobMatch records for this job
  const existingJobMatches = await JobMatch.find({ jobId: targetJobId }).lean();
  const matchMap = new Map<string, any>();
  for (const jm of existingJobMatches) {
    matchMap.set(jm.studentId.toString(), jm);
  }

  // 3. Find candidate pool: all students who applied OR have an existing match OR are in the student pool
  // Combine applicant IDs and match user IDs
  const combinedUserIds = Array.from(new Set([...applicantUserIds, ...existingJobMatches.map(m => m.studentId.toString())]));

  // Also include general students with role 'student' if total candidates pool is small (< 50)
  let candidateUsers = await User.find({
    _id: { $in: combinedUserIds },
    role: 'student'
  }).lean();

  // If there are other students in the database not yet matched, load them to provide a rich candidate discovery pool
  const allStudents = await User.find({ role: 'student' }).lean();
  const studentMap = new Map<string, any>();
  for (const u of candidateUsers) {
    studentMap.set(u._id.toString(), u);
  }
  for (const s of allStudents) {
    if (!studentMap.has(s._id.toString())) {
      studentMap.set(s._id.toString(), s);
    }
  }
  const fullCandidatesPool = Array.from(studentMap.values());

  // 4. Fetch Resumes for these candidates
  const candidateIds = fullCandidatesPool.map(c => c._id);
  const resumes = await Resume.find({ userId: { $in: candidateIds } }).lean();
  const resumeMap = new Map<string, any>();
  for (const r of resumes) {
    resumeMap.set(r.userId.toString(), r);
  }

  // 5. Fetch InterviewEvaluations for these candidates on this job
  const interviewEvaluations = await InterviewEvaluation.find({
    jobId: targetJobId,
    candidateId: { $in: candidateIds }
  }).sort({ conductedAt: -1 }).lean();
  const evalMap = new Map<string, any>();
  for (const ev of interviewEvaluations) {
    const cId = ev.candidateId.toString();
    if (!evalMap.has(cId)) {
      evalMap.set(cId, ev);
    }
  }

  // 6. Map of applications by studentId
  const appMap = new Map<string, any>();
  for (const a of applications) {
    appMap.set(a.studentId.toString(), a);
  }

  // 7. Assemble CandidateRankingItems and compute missing JobMatches lazily
  const candidateItems: CandidateRankingItem[] = [];

  for (const candidate of fullCandidatesPool) {
    const cIdStr = candidate._id.toString();
    const app = appMap.get(cIdStr);
    const resume = resumeMap.get(cIdStr);
    const evaluation = evalMap.get(cIdStr);

    let match = matchMap.get(cIdStr);

    // If JobMatch does not exist, compute lazily using calculateDetailedMatchScore
    if (!match) {
      const resumeText = resume ? resume.extractedText : '';
      const candidateExp = (candidate.yearsOfExperience !== undefined && candidate.yearsOfExperience !== null)
        ? candidate.yearsOfExperience
        : estimateExperience(resumeText || '');

      const detailed = calculateDetailedMatchScore(
        candidate.skills || [],
        candidateExp,
        candidate.education || '',
        resumeText || '',
        job.requiredSkills || [],
        job.experience || 0,
        job.description || ''
      );

      // Lazily persist JobMatch (catch errors to ensure non-blocking read)
      try {
        const newMatch = await JobMatch.findOneAndUpdate(
          { studentId: candidate._id, jobId: targetJobId },
          {
            studentId: candidate._id,
            jobId: targetJobId,
            matchScore: detailed.matchScore,
            skillsMatch: detailed.skillsMatch,
            experienceMatch: detailed.experienceMatch,
            educationMatch: detailed.educationMatch,
            calculatedAt: new Date()
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        match = newMatch.toObject();
        matchMap.set(cIdStr, match);
      } catch (err) {
        match = detailed;
      }
    }

    // Compute matchedSkills and missingSkills against job.requiredSkills
    const candSkills: string[] = candidate.skills || [];
    const jobSkills: string[] = job.requiredSkills || [];

    const matchedSkills = jobSkills.filter(reqSkill =>
      candSkills.some(cs => cs.toLowerCase().trim() === reqSkill.toLowerCase().trim())
    );
    const missingSkills = jobSkills.filter(reqSkill =>
      !candSkills.some(cs => cs.toLowerCase().trim() === reqSkill.toLowerCase().trim())
    );

    const applicationStatus: 'applied' | 'interviewing' | 'accepted' | 'rejected' | 'pool' =
      app ? app.status : 'pool';

    candidateItems.push({
      candidateId: cIdStr,
      name: candidate.name || 'Candidate',
      email: candidate.email || '',
      careerLevel: candidate.careerLevel || 'Mid-Level',
      yearsOfExperience: candidate.yearsOfExperience ?? 0,
      education: candidate.education || 'Not specified',
      profileImage: candidate.profileImage,
      applicationId: app ? app._id.toString() : undefined,
      applicationStatus,
      appliedAt: app ? new Date(app.appliedAt).toISOString() : undefined,
      matchScore: match.matchScore ?? 0,
      skillsMatch: match.skillsMatch ?? 0,
      experienceMatch: match.experienceMatch ?? 0,
      educationMatch: match.educationMatch ?? 0,
      matchedSkills,
      missingSkills,
      hasInterviewEvaluation: Boolean(evaluation),
      interviewRecommendation: evaluation ? evaluation.recommendation : undefined
    });
  }

  // 8. Compute overall summary statistics across all discovered candidates for this job
  const totalCount = candidateItems.length;
  const strongMatchesCount = candidateItems.filter(c => c.matchScore >= 80).length;
  const inInterviewCount = candidateItems.filter(c => c.applicationStatus === 'interviewing').length;
  const avgScore = totalCount > 0
    ? Math.round(candidateItems.reduce((acc, c) => acc + c.matchScore, 0) / totalCount)
    : 0;

  const summaryStats: RecruitmentSummaryStats = {
    totalCandidates: totalCount,
    strongMatches: strongMatchesCount,
    inInterview: inInterviewCount,
    averageMatchScore: avgScore
  };

  // 9. Apply filters
  let filtered = [...candidateItems];

  if (filter.minScore !== undefined && filter.minScore !== null) {
    const minVal = Number(filter.minScore);
    if (!isNaN(minVal)) {
      filtered = filtered.filter(c => c.matchScore >= minVal);
    }
  }

  if (filter.status && filter.status !== 'all') {
    filtered = filtered.filter(c => c.applicationStatus.toLowerCase() === filter.status!.toLowerCase());
  }

  if (filter.skillFilter && filter.skillFilter.trim().length > 0) {
    const targetSkill = filter.skillFilter.toLowerCase().trim();
    filtered = filtered.filter(c =>
      c.matchedSkills.some(s => s.toLowerCase().includes(targetSkill)) ||
      (fullCandidatesPool.find(p => p._id.toString() === c.candidateId)?.skills || [])
        .some((s: string) => s.toLowerCase().includes(targetSkill))
    );
  }

  if (filter.search && filter.search.trim().length > 0) {
    const term = filter.search.toLowerCase().trim();
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.careerLevel.toLowerCase().includes(term) ||
      c.matchedSkills.some(s => s.toLowerCase().includes(term))
    );
  }

  // 10. Apply sorting
  const sortBy = filter.sortBy || 'matchScore';
  const sortOrder = filter.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'matchScore') {
      comparison = b.matchScore - a.matchScore;
    } else if (sortBy === 'skillsMatch') {
      comparison = b.skillsMatch - a.skillsMatch;
    } else if (sortBy === 'experienceMatch') {
      comparison = b.experienceMatch - a.experienceMatch;
    } else if (sortBy === 'appliedAt') {
      const timeA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const timeB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      comparison = timeB - timeA;
    }

    if (sortOrder === 'asc') {
      comparison = -comparison;
    }
    return comparison;
  });

  // 11. Apply limit if provided
  if (filter.limit && filter.limit > 0) {
    filtered = filtered.slice(0, filter.limit);
  }

  return {
    candidates: filtered,
    summary: summaryStats,
    job: {
      _id: job._id.toString(),
      title: job.title,
      company: job.company,
      requiredSkills: job.requiredSkills || [],
      experience: job.experience || 0,
      location: job.location,
      status: job.status
    }
  };
}

/**
 * Retrieves summary statistics only for a specific job.
 */
export async function getJobRecruitmentSummary(
  jobId: string,
  recruiterId: string,
  userRole: string
): Promise<RecruitmentSummaryStats> {
  const result = await getRankedCandidates({ jobId }, recruiterId, userRole);
  return result.summary;
}

/**
 * Sanitizes a string for CSV to prevent Formula Injection (CSV Injection).
 * Any cell beginning with '=', '+', '-', or '@' is prefixed with an apostrophe.
 */
export function sanitizeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '""';
  }
  let str = String(val).trim();

  // Guard against formula injection vulnerabilities
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    str = `'${str}`;
  }

  // Escape quotes and enclose in double quotes per RFC 4180
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates an RFC 4180 compliant CSV export string of ranked candidates.
 */
export async function generateCandidateCsv(
  jobId: string,
  filter: CandidateRankingFilter,
  recruiterId: string,
  userRole: string
): Promise<{ filename: string; csv: string }> {
  const { candidates, job } = await getRankedCandidates(filter, recruiterId, userRole);

  const headers = [
    'Rank',
    'Candidate Name',
    'Email',
    'Career Level',
    'Years of Experience',
    'Education',
    'Overall Match Score (%)',
    'Skills Match (%)',
    'Experience Match (%)',
    'Education Match (%)',
    'Application Status',
    'Interview Recommendation',
    'Applied Date',
    'Matched Skills',
    'Missing Skills'
  ];

  const rows: string[] = [headers.map(h => `"${h}"`).join(',')];

  candidates.forEach((cand, idx) => {
    const row = [
      sanitizeCsvField(idx + 1),
      sanitizeCsvField(cand.name),
      sanitizeCsvField(cand.email),
      sanitizeCsvField(cand.careerLevel),
      sanitizeCsvField(cand.yearsOfExperience),
      sanitizeCsvField(cand.education),
      sanitizeCsvField(cand.matchScore),
      sanitizeCsvField(cand.skillsMatch),
      sanitizeCsvField(cand.experienceMatch),
      sanitizeCsvField(cand.educationMatch),
      sanitizeCsvField(cand.applicationStatus.toUpperCase()),
      sanitizeCsvField(cand.interviewRecommendation || 'Pending Evaluation'),
      sanitizeCsvField(cand.appliedAt ? cand.appliedAt.slice(0, 10) : 'Not Applied'),
      sanitizeCsvField(cand.matchedSkills.join('; ')),
      sanitizeCsvField(cand.missingSkills.join('; '))
    ];
    rows.push(row.join(','));
  });

  const sanitizedTitle = job.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `candidates_${sanitizedTitle}_${dateStr}.csv`;

  return {
    filename,
    csv: rows.join('\r\n')
  };
}
