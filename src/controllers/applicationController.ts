import { NextResponse } from 'next/server';
import Application from '@/models/Application';
import Job from '@/models/Job';
import Resume from '@/models/Resume';
import Notification from '@/models/Notification';
import { calculateMatchScore } from '@/services/matching';
import { updateApplicationStatusSchema } from '@/validations/validation';
import { sendApplicationConfirmationEmail } from '@/services/email';


export async function applyToJob(req: any) {
  try {
    const user = req.user;
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required.' }, { status: 400 });
    }

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job posting not found.' }, { status: 404 });
    }

    if (job.status !== 'active') {
      return NextResponse.json({ error: 'This job listing is no longer active.' }, { status: 400 });
    }

    // Check if student has already applied
    const existingApp = await Application.findOne({ studentId: user._id, jobId });
    if (existingApp) {
      return NextResponse.json({ error: 'You have already applied for this job.' }, { status: 400 });
    }

    // Retrieve student resume for matching score
    const resume = await Resume.findOne({ userId: user._id });
    if (!resume) {
      return NextResponse.json({ error: 'Please upload a resume first to apply for jobs.' }, { status: 400 });
    }

    // Calculate match score
    const matchScore = calculateMatchScore(
      user.skills,
      1, // default candidate experience
      user.education || '',
      resume.extractedText,
      job.requiredSkills,
      job.experience,
      job.description
    );

    const application = new Application({
      studentId: user._id,
      jobId,
      matchScore,
      status: 'applied'
    });

    await application.save();

    // Create notification for recruiter
    const notification = new Notification({
      userId: job.recruiterId,
      title: 'New Job Application Received',
      message: `${user.name} applied for your posting "${job.title}". Match Score: ${matchScore}%`
    });
    await notification.save();

    // Dispatch application confirmation email to student asynchronously (non-blocking)
    sendApplicationConfirmationEmail({
      to: user.email,
      studentName: user.name,
      jobTitle: job.title,
      companyName: job.company,
      date: new Date()
    }).catch((emailError) => {
      console.error('Non-blocking application confirmation email dispatch failed:', emailError);
    });

    return NextResponse.json({
      message: 'Application submitted successfully.',
      application
    }, { status: 201 });

  } catch (error: any) {
    console.error('Apply job error:', error);
    return NextResponse.json({ error: 'Internal server error while applying to job.' }, { status: 500 });
  }
}

export async function getApplications(req: any) {
  try {
    const user = req.user;

    if (user.role === 'student') {
      const applications = await Application.find({ studentId: user._id })
        .populate('jobId')
        .sort({ appliedAt: -1 });
      return NextResponse.json({ applications });
    } else if (user.role === 'recruiter') {
      const jobs = await Job.find({ recruiterId: user._id });
      const jobIds = jobs.map((j) => j._id);

      const applications = await Application.find({ jobId: { $in: jobIds } })
        .populate('jobId')
        .populate('studentId', 'name email skills education profileImage')
        .sort({ appliedAt: -1 });

      return NextResponse.json({ applications });
    } else if (user.role === 'admin') {
      const applications = await Application.find()
        .populate('jobId')
        .populate('studentId', 'name email skills education profileImage')
        .sort({ appliedAt: -1 });
      return NextResponse.json({ applications });
    }

    return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
  } catch (error: any) {
    console.error('Get applications error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving applications.' }, { status: 500 });
  }
}

export async function updateApplicationStatus(req: any, { params }: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = params;
    const body = await req.json();

    // Validate status
    const validation = updateApplicationStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { status } = validation.data;

    // Retrieve application
    const application = await Application.findById(id).populate('jobId');
    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    const job = application.jobId as any;

    // Verify recruiter ownership or admin privilege
    if (job.recruiterId.toString() !== user._id.toString() && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. You do not have permission to manage this application.' }, { status: 403 });
    }

    application.status = status;
    await application.save();

    // Create notification for student
    const notification = new Notification({
      userId: application.studentId,
      title: 'Application Status Updated',
      message: `Your application status for "${job.title}" at ${job.company} has been updated to "${status}".`
    });
    await notification.save();

    return NextResponse.json({
      message: 'Application status updated successfully.',
      application
    });
  } catch (error: any) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Internal server error updating application status.' }, { status: 500 });
  }
}
