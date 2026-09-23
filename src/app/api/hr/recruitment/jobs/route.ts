import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import Job from '@/models/Job';
import Application from '@/models/Application';

/**
 * GET /api/hr/recruitment/jobs
 * Retrieves active job listings accessible to the authenticated recruiter or admin.
 * Recruiters see jobs they posted. Admins see all active jobs.
 */
export const GET = withAuth(async (req: any) => {
  try {
    const user = req.user;

    const filter: any = { status: 'active' };
    if (user.role !== 'admin') {
      filter.recruiterId = user._id;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Attach candidate / application counts to each job for the selector UI
    const jobIds = jobs.map(j => j._id);
    const applications = await Application.find({ jobId: { $in: jobIds } }).lean();

    const appCountMap = new Map<string, number>();
    for (const app of applications) {
      const jId = app.jobId.toString();
      appCountMap.set(jId, (appCountMap.get(jId) || 0) + 1);
    }

    const decoratedJobs = jobs.map(j => ({
      _id: j._id.toString(),
      title: j.title,
      company: j.company,
      location: j.location,
      experience: j.experience,
      requiredSkills: j.requiredSkills || [],
      candidateCount: appCountMap.get(j._id.toString()) || 0,
      createdAt: j.createdAt
    }));

    return NextResponse.json({
      jobs: decoratedJobs
    }, { status: 200 });
  } catch (error: any) {
    console.error('Recruitment jobs error:', error);
    return NextResponse.json({
      error: 'Internal server error retrieving recruitment jobs.'
    }, { status: 500 });
  }
}, ['recruiter', 'admin']);
