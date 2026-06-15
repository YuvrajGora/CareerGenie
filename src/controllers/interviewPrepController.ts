import { NextResponse } from 'next/server';
import InterviewPrep from '@/models/InterviewPrep';
import Job from '@/models/Job';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import { generateInterviewPrep } from '@/services/gemini';
import { interviewPrepSchema } from '@/validations/validation';

export async function getOrGeneratePrep(req: any) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. User not found on request.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = interviewPrepSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { jobId, refresh } = parseResult.data;


    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    // If not refreshing, check database cache first
    if (!refresh) {
      const cached = await InterviewPrep.findOne({ userId: user._id, jobId });
      if (cached) {
        return NextResponse.json({ interviewPrep: cached });
      }
    }

    // Fetch candidate resume
    const resume = await Resume.findOne({ userId: user._id });
    let latestAnalysis = null;
    if (resume) {
      latestAnalysis = await ResumeAnalysis.findOne({ resumeId: resume._id });
    }

    // Prepare inputs safely (with robust fallbacks)
    const resumeText = resume?.extractedText || '';
    const atsAnalysis = latestAnalysis
      ? {
          strengths: latestAnalysis.strengths || [],
          weaknesses: latestAnalysis.weaknesses || [],
          missingSkills: latestAnalysis.missingSkills || []
        }
      : { strengths: [], weaknesses: [], missingSkills: [] };

    const candidateSkills = user.skills || [];
    const experienceLevel = user.careerLevel || 'Junior';
    const yearsOfExperience = typeof user.yearsOfExperience === 'number' ? user.yearsOfExperience : 0;
    const jobDescription = job.description || '';

    // Generate using Gemini service
    const generatedData = await generateInterviewPrep(
      resumeText,
      atsAnalysis,
      jobDescription,
      candidateSkills,
      experienceLevel,
      yearsOfExperience
    );

    // Cache the results in MongoDB
    const updatedPrep = await InterviewPrep.findOneAndUpdate(
      { userId: user._id, jobId },
      {
        questions: generatedData.questions,
        weaknesses: generatedData.weaknesses,
        generatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ interviewPrep: updatedPrep });
  } catch (error: any) {
    console.error('Error in getOrGeneratePrep controller:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve or generate interview preparation details.' },
      { status: 500 }
    );
  }
}
