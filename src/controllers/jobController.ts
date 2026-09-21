import { NextRequest, NextResponse } from 'next/server';
import Job from '@/models/Job';
import { createJobSchema } from '@/validations/validation';
import { verifyToken } from '@/middleware/auth';
import User from '@/models/User';
import Resume from '@/models/Resume';
import JobMatch from '@/models/JobMatch';
import { calculateDetailedMatchScore, estimateExperience } from '@/services/matching';

export async function createJob(req: any) {
  try {
    const user = req.user;
    const body = await req.json();

    // Validate request body
    const validation = createJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const job = new Job({
      ...validation.data,
      recruiterId: user._id,
      status: 'active'
    });

    await job.save();

    return NextResponse.json({
      message: 'Job posting created successfully.',
      job
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create job error:', error);
    return NextResponse.json({ error: 'Internal server error while creating job.' }, { status: 500 });
  }
}

export async function getJobs(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const location = searchParams.get('location') || '';
    const skills = searchParams.get('skills') || '';

    // Build filter object
    const filter: any = { status: 'active' };

    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { company: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (skills) {
      const skillsList = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillsList.length > 0) {
        filter.requiredSkills = { $in: skillsList };
      }
    }

    const jobs = await Job.find(filter).sort({ createdAt: -1 });

    const decoded = verifyToken(req);
    let studentMatchesMap = new Map();
    let hasResume = false;
    let loggedInUser: any = null;
    let userResume: any = null;

    if (decoded && decoded.role === 'student') {
      loggedInUser = await User.findById(decoded.userId);
      userResume = await Resume.findOne({ userId: decoded.userId });
      if (loggedInUser && userResume) {
        hasResume = true;
        const matches = await JobMatch.find({ studentId: decoded.userId });
        for (const m of matches) {
          studentMatchesMap.set(m.jobId.toString(), m.matchScore);
        }
      }
    }

    const decoratedJobs = [];
    for (const job of jobs) {
      let matchScore = null;
      if (decoded && decoded.role === 'student') {
        const jobIdStr = job._id.toString();
        if (studentMatchesMap.has(jobIdStr)) {
          matchScore = studentMatchesMap.get(jobIdStr);
        } else if (hasResume && loggedInUser && userResume) {
          const candidateExp = (loggedInUser.yearsOfExperience !== undefined && loggedInUser.yearsOfExperience !== null)
            ? loggedInUser.yearsOfExperience
            : estimateExperience(userResume.extractedText || '');

          const result = calculateDetailedMatchScore(
            loggedInUser.skills || [],
            candidateExp,
            loggedInUser.education || '',
            userResume.extractedText || '',
            job.requiredSkills || [],
            job.experience || 0,
            job.description || ''
          );

          JobMatch.create({
            studentId: decoded.userId,
            jobId: job._id,
            matchScore: result.matchScore,
            skillsMatch: result.skillsMatch,
            experienceMatch: result.experienceMatch,
            educationMatch: result.educationMatch
          }).catch(err => console.error('Error saving JobMatch:', err));

          matchScore = result.matchScore;
        }
      }

      const jobObj = job.toObject() as any;
      if (matchScore !== null) {
        jobObj.matchScore = matchScore;
      }
      decoratedJobs.push(jobObj);
    }

    return NextResponse.json({ jobs: decoratedJobs });
  } catch (error: any) {
    console.error('Get jobs error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving jobs.' }, { status: 500 });
  }
}

export async function getJobById(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const job = await Job.findById(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    const decoded = verifyToken(req);
    let match = null;

    if (decoded && decoded.role === 'student') {
      const existing = await JobMatch.findOne({ studentId: decoded.userId, jobId: job._id });
      if (existing) {
        match = {
          matchScore: existing.matchScore,
          skillsMatch: existing.skillsMatch,
          experienceMatch: existing.experienceMatch,
          educationMatch: existing.educationMatch
        };
      } else {
        const loggedInUser = await User.findById(decoded.userId);
        const userResume = await Resume.findOne({ userId: decoded.userId });
        if (loggedInUser && userResume) {
          const candidateExp = (loggedInUser.yearsOfExperience !== undefined && loggedInUser.yearsOfExperience !== null)
            ? loggedInUser.yearsOfExperience
            : estimateExperience(userResume.extractedText || '');

          const result = calculateDetailedMatchScore(
            loggedInUser.skills || [],
            candidateExp,
            loggedInUser.education || '',
            userResume.extractedText || '',
            job.requiredSkills || [],
            job.experience || 0,
            job.description || ''
          );

          await JobMatch.create({
            studentId: decoded.userId,
            jobId: job._id,
            matchScore: result.matchScore,
            skillsMatch: result.skillsMatch,
            experienceMatch: result.experienceMatch,
            educationMatch: result.educationMatch
          });

          match = result;
        }
      }
    }

    return NextResponse.json({ job, match });
  } catch (error: any) {
    console.error('Get job by ID error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving job.' }, { status: 500 });
  }
}


export async function updateJob(req: any, { params }: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = params;
    const body = await req.json();

    const job = await Job.findById(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    // Verify ownership or admin role
    const jobRecruiterId = job.recruiterId?.toString();
    const isOwner = Boolean(jobRecruiterId && user?._id && jobRecruiterId === user._id.toString());
    const isAdmin = user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden. You do not have permission to modify this listing.' }, { status: 403 });
    }

    // Validate partial updates
    const validation = createJobSchema.partial().safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const updatedJob = await Job.findByIdAndUpdate(
      id,
      { $set: validation.data },
      { new: true }
    );

    return NextResponse.json({
      message: 'Job posting updated successfully.',
      job: updatedJob
    });
  } catch (error: any) {
    console.error('Update job error:', error);
    return NextResponse.json({ error: 'Internal server error updating job.' }, { status: 500 });
  }
}

export async function deleteJob(req: any, { params }: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = params;

    const job = await Job.findById(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    // Verify ownership or admin role
    const jobRecruiterId = job.recruiterId?.toString();
    const isOwner = Boolean(jobRecruiterId && user?._id && jobRecruiterId === user._id.toString());
    const isAdmin = user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden. You do not have permission to delete this listing.' }, { status: 403 });
    }

    await Job.findByIdAndDelete(id);

    return NextResponse.json({
      message: 'Job posting deleted successfully.'
    });
  } catch (error: any) {
    console.error('Delete job error:', error);
    return NextResponse.json({ error: 'Internal server error deleting job.' }, { status: 500 });
  }
}
