import { NextResponse } from 'next/server';
import CoverLetter from '@/models/CoverLetter';
import Job from '@/models/Job';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import { generateCoverLetter } from '@/services/gemini';
import { coverLetterSchema } from '@/validations/validation';

export async function getOrGenerateCoverLetter(req: any) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. User not found on request.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = coverLetterSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { jobId, tone, refresh } = parseResult.data;


    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    // If not refreshing, check database cache first
    if (!refresh) {
      const cached = await CoverLetter.findOne({ userId: user._id, jobId, tone });
      if (cached) {
        return NextResponse.json({ coverLetter: cached });
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

    const jobDescription = job.description || '';
    const companyName = job.company || 'the company';
    const jobTitle = job.title || 'the position';

    // Generate using Gemini service
    const generatedContent = await generateCoverLetter(
      resumeText,
      atsAnalysis,
      jobDescription,
      companyName,
      jobTitle,
      tone
    );

    // Cache the results in MongoDB
    const updatedCoverLetter = await CoverLetter.findOneAndUpdate(
      { userId: user._id, jobId, tone },
      {
        content: generatedContent,
        generatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ coverLetter: updatedCoverLetter });
  } catch (error: any) {
    console.error('Error in getOrGenerateCoverLetter controller:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve or generate cover letter details.' },
      { status: 500 }
    );
  }
}
