import { NextResponse } from 'next/server';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import User from '@/models/User';
import { uploadToCloudinary } from '@/services/cloudinary';
import { analyzeResume } from '@/services/gemini';
import { recalculateUserMatchScores } from '@/services/matching';
import JobMatch from '@/models/JobMatch';
import { recordActivity } from '@/services/activity';

export async function uploadResume(req: any) {
  try {
    const user = req.user; // populated by auth middleware
    const body = await req.json();

    const { file, text } = body; // file is base64 string, text is optional extracted text

    if (!file) {
      return NextResponse.json({ error: 'Resume file data is required (base64 string).' }, { status: 400 });
    }

    const extractedText = text || 'Extracted candidate resume details for user: ' + user.name;

    // 1. Upload file to Cloudinary (returns fallback mock URL if config is empty)
    const fileUrl = await uploadToCloudinary(file, 'resumes');

    // 2. Save or update resume record
    let resume = await Resume.findOne({ userId: user._id });
    if (resume) {
      resume.fileUrl = fileUrl;
      resume.extractedText = extractedText;
      resume.version += 1;
      resume.uploadedAt = new Date();
      await resume.save();
    } else {
      resume = new Resume({
        userId: user._id,
        fileUrl,
        extractedText,
        version: 1
      });
      await resume.save();
    }

    await recordActivity(user._id, 'Resume Uploaded', 'Uploaded new resume draft.');

    // 3. Analyze resume text with Gemini
    const analysisResult = await analyzeResume(extractedText);

    // 4. Save or update resume analysis report
    let analysis = await ResumeAnalysis.findOne({ resumeId: resume._id });
    if (analysis) {
      analysis.overallScore = analysisResult.overallScore;
      analysis.atsScore = analysisResult.atsScore;
      analysis.strengths = analysisResult.strengths;
      analysis.weaknesses = analysisResult.weaknesses;
      analysis.missingSkills = analysisResult.missingSkills;
      analysis.suggestions = analysisResult.suggestions;
      analysis.yearsOfExperience = analysisResult.yearsOfExperience;
      analysis.careerLevel = analysisResult.careerLevel;
      analysis.analyzedAt = new Date();
      await analysis.save();
    } else {
      analysis = new ResumeAnalysis({
        resumeId: resume._id,
        overallScore: analysisResult.overallScore,
        atsScore: analysisResult.atsScore,
        strengths: analysisResult.strengths,
        weaknesses: analysisResult.weaknesses,
        missingSkills: analysisResult.missingSkills,
        suggestions: analysisResult.suggestions,
        yearsOfExperience: analysisResult.yearsOfExperience,
        careerLevel: analysisResult.careerLevel
      });
      await analysis.save();
    }

    // 5. Automatically sync extracted skills, years of experience, and career level back to User Profile
    const updateFields: any = {};
    if (analysisResult.yearsOfExperience !== undefined && analysisResult.yearsOfExperience !== null) {
      updateFields.yearsOfExperience = analysisResult.yearsOfExperience;
    }
    if (analysisResult.careerLevel) {
      updateFields.careerLevel = analysisResult.careerLevel;
    }

    if (analysisResult.extractedSkills && analysisResult.extractedSkills.length > 0) {
      const existingSkills = new Set(user.skills.map((s: string) => s.toLowerCase().trim()));
      
      analysisResult.extractedSkills.forEach((skill: string) => {
        existingSkills.add(skill.toLowerCase().trim());
      });

      // Maintain original casing of extracted skills where possible
      const updatedSkills = Array.from(existingSkills).map((skillKey) => {
        const originalMatch = analysisResult.extractedSkills.find(
          (s: string) => s.toLowerCase().trim() === skillKey
        );
        return originalMatch || skillKey;
      });

      updateFields.skills = updatedSkills;
    }

    if (Object.keys(updateFields).length > 0) {
      await User.findByIdAndUpdate(user._id, { $set: updateFields });
    }

    // 6. Recalculate match scores for the user using the newly updated profile fields
    await recalculateUserMatchScores(user._id);

    // Fetch average match score for trend tracking
    const matches = await JobMatch.find({ studentId: user._id });
    const avgMatchScore = matches.length > 0
      ? Math.round(matches.reduce((acc: number, m: any) => acc + m.matchScore, 0) / matches.length)
      : 0;

    await recordActivity(
      user._id,
      'Resume Analyzed',
      `AI Score: ${analysisResult.overallScore}/100. ATS Score: ${analysisResult.atsScore}/100.`,
      {
        atsScore: analysisResult.atsScore,
        overallScore: analysisResult.overallScore,
        avgMatchScore
      }
    );

    return NextResponse.json({
      message: 'Resume uploaded and analyzed successfully.',
      resume,
      analysis
    }, { status: 201 });

  } catch (error: any) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Internal server error during resume upload.' }, { status: 500 });
  }
}

export async function getResume(req: any) {
  try {
    const user = req.user;
    const resume = await Resume.findOne({ userId: user._id });
    if (!resume) {
      return NextResponse.json({ error: 'No resume found for this user.' }, { status: 404 });
    }
    return NextResponse.json({ resume });
  } catch (error: any) {
    console.error('Get resume error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving resume.' }, { status: 500 });
  }
}

export async function getResumeAnalysis(req: any) {
  try {
    const user = req.user;
    const resume = await Resume.findOne({ userId: user._id });
    if (!resume) {
      return NextResponse.json({ error: 'No resume found for this user.' }, { status: 404 });
    }

    const analysis = await ResumeAnalysis.findOne({ resumeId: resume._id });
    if (!analysis) {
      return NextResponse.json({ error: 'No analysis report found for this resume.' }, { status: 404 });
    }

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Get resume analysis error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving analysis report.' }, { status: 500 });
  }
}
