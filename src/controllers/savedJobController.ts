import { NextResponse } from 'next/server';
import SavedJob from '@/models/SavedJob';
import Job from '@/models/Job';

export async function saveJob(req: any) {
  try {
    const user = req.user;
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required.' }, { status: 400 });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    const existing = await SavedJob.findOne({ studentId: user._id, jobId });
    if (existing) {
      return NextResponse.json({ message: 'Job is already saved.', savedJob: existing });
    }

    const savedJob = new SavedJob({
      studentId: user._id,
      jobId
    });

    await savedJob.save();

    return NextResponse.json({
      message: 'Job saved successfully.',
      savedJob
    }, { status: 201 });
  } catch (error: any) {
    console.error('Save job error:', error);
    return NextResponse.json({ error: 'Internal server error while saving job.' }, { status: 500 });
  }
}

export async function unsaveJob(req: any, { params }: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id: jobId } = params;

    const deleted = await SavedJob.findOneAndDelete({ studentId: user._id, jobId });
    if (!deleted) {
      return NextResponse.json({ error: 'Saved job bookmark not found.' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Job removed from saved list successfully.'
    });
  } catch (error: any) {
    console.error('Unsave job error:', error);
    return NextResponse.json({ error: 'Internal server error while removing saved job.' }, { status: 500 });
  }
}

export async function getSavedJobs(req: any) {
  try {
    const user = req.user;

    const savedJobs = await SavedJob.find({ studentId: user._id })
      .populate('jobId')
      .sort({ savedAt: -1 });

    return NextResponse.json({ savedJobs });
  } catch (error: any) {
    console.error('Get saved jobs error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving saved jobs.' }, { status: 500 });
  }
}
