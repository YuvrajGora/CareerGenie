import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { withAuth } from '@/middleware/auth';
import User from '@/models/User';
import Resume from '@/models/Resume';
import JobMatch from '@/models/JobMatch';
import { verifyJobRecruiterAccess } from '@/services/recruitmentIntelligenceService';
import { generateRecruitmentMatchExplanation } from '@/services/gemini';
import { calculateDetailedMatchScore, estimateExperience } from '@/services/matching';

/**
 * GET /api/hr/recruitment/explain
 * Generates an evidence-grounded AI explanation of a candidate's deterministic match score.
 * Verifies recruiter ownership and RBAC.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const user = req.user;
    const { searchParams } = new URL(req.url);

    const jobId = searchParams.get('jobId');
    const candidateId = searchParams.get('candidateId');

    if (!jobId || !candidateId) {
      return NextResponse.json({
        error: 'Both jobId and candidateId parameters are required.'
      }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return NextResponse.json({
        error: 'Invalid candidateId format.'
      }, { status: 400 });
    }

    // 1. Verify recruiter access to this job
    const job = await verifyJobRecruiterAccess(jobId, user._id.toString(), user.role);

    // 2. Fetch candidate profile
    const candidate = await User.findById(candidateId).lean();
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate profile not found.' }, { status: 404 });
    }

    // 3. Fetch candidate resume
    const resume = await Resume.findOne({ userId: candidate._id }).lean();
    const resumeText = resume ? resume.extractedText : '';

    // 4. Retrieve or compute deterministic JobMatch
    let match = await JobMatch.findOne({ studentId: candidate._id, jobId: job._id }).lean();

    if (!match) {
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

      const created = await JobMatch.findOneAndUpdate(
        { studentId: candidate._id, jobId: job._id },
        {
          studentId: candidate._id,
          jobId: job._id,
          matchScore: detailed.matchScore,
          skillsMatch: detailed.skillsMatch,
          experienceMatch: detailed.experienceMatch,
          educationMatch: detailed.educationMatch,
          calculatedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      match = created.toObject();
    }

    const candSkills = candidate.skills || [];
    const reqSkills = job.requiredSkills || [];

    const matchedSkills = reqSkills.filter(req =>
      candSkills.some(cs => cs.toLowerCase().trim() === req.toLowerCase().trim())
    );
    const missingSkills = reqSkills.filter(req =>
      !candSkills.some(cs => cs.toLowerCase().trim() === req.toLowerCase().trim())
    );

    const matchScores = {
      matchScore: match.matchScore ?? 0,
      skillsMatch: match.skillsMatch ?? 0,
      experienceMatch: match.experienceMatch ?? 0,
      educationMatch: match.educationMatch ?? 0
    };

    // 5. Generate fact-grounded explanation
    const explanation = await generateRecruitmentMatchExplanation(
      {
        title: job.title,
        company: job.company,
        description: job.description || '',
        requiredSkills: reqSkills,
        experience: job.experience || 0,
        location: job.location
      },
      {
        name: candidate.name,
        careerLevel: candidate.careerLevel || 'Mid-Level',
        yearsOfExperience: candidate.yearsOfExperience ?? 0,
        education: candidate.education || 'Not specified',
        skills: candSkills,
        resumeText: resumeText || ''
      },
      matchScores
    );

    return NextResponse.json({
      explanation,
      scores: matchScores,
      matchedSkills,
      missingSkills,
      candidate: {
        _id: candidate._id.toString(),
        name: candidate.name,
        email: candidate.email,
        careerLevel: candidate.careerLevel,
        yearsOfExperience: candidate.yearsOfExperience,
        education: candidate.education,
        skills: candidate.skills
      },
      job: {
        _id: job._id.toString(),
        title: job.title,
        company: job.company,
        requiredSkills: job.requiredSkills,
        experience: job.experience
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Recruitment explain error:', error);
    const message = error.message || 'Internal server error generating recruitment explanation.';
    const statusCode = message.includes('Forbidden') ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, ['recruiter', 'admin']);
