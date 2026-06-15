import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import ResumeVersion from '@/models/ResumeVersion';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import User from '@/models/User';
import JobMatch from '@/models/JobMatch';
import {
  analyzeResume,
  improveBulletPoint,
  rewriteSummary,
  suggestActionVerbs
} from '@/services/gemini';
import { recalculateUserMatchScores } from '@/services/matching';
import { recordActivity } from '@/services/activity';

function compileResumeText(version: any): string {
  let text = `Name: ${version.personalInfo?.name || ''}\n`;
  text += `Email: ${version.personalInfo?.email || ''}\n`;
  text += `Phone: ${version.personalInfo?.phone || ''}\n`;
  if (version.personalInfo?.linkedin) text += `LinkedIn: ${version.personalInfo.linkedin}\n`;
  if (version.personalInfo?.github) text += `GitHub: ${version.personalInfo.github}\n`;
  if (version.personalInfo?.website) text += `Website: ${version.personalInfo.website}\n\n`;
  
  text += `Summary:\n${version.summary || ''}\n\n`;
  
  text += `Education:\n`;
  (version.education || []).forEach((edu: any) => {
    text += `- ${edu.institution || ''}: ${edu.degree || ''} in ${edu.fieldOfStudy || ''} (${edu.startDate || ''} - ${edu.endDate || ''}) ${edu.gpa ? `GPA: ${edu.gpa}` : ''}\n`;
  });
  text += `\n`;
  
  text += `Experience:\n`;
  (version.experience || []).forEach((exp: any) => {
    text += `- ${exp.position || ''} at ${exp.company || ''} (${exp.startDate || ''} - ${exp.endDate || ''})\n`;
    (exp.description || []).forEach((bullet: string) => {
      text += `  * ${bullet}\n`;
    });
  });
  text += `\n`;
  
  text += `Projects:\n`;
  (version.projects || []).forEach((proj: any) => {
    text += `- ${proj.title || ''} (${proj.role || ''}): ${proj.technologies?.join(', ') || ''}\n`;
    (proj.description || []).forEach((bullet: string) => {
      text += `  * ${bullet}\n`;
    });
  });
  text += `\n`;
  
  text += `Skills: ${version.skills?.join(', ') || ''}\n\n`;
  text += `Certifications: ${version.certifications?.join(', ') || ''}\n`;
  return text;
}

export async function getResumeVersions(req: any) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const versions = await ResumeVersion.find({ userId: user._id }).sort({ updatedAt: -1 });
    return NextResponse.json({ versions });
  } catch (error: any) {
    console.error('Error fetching resume versions:', error);
    return NextResponse.json({ error: 'Failed to retrieve resume versions.' }, { status: 500 });
  }
}

export async function createResumeVersion(req: any) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const body = await req.json();
    const { title, targetRole, template, personalInfo, summary, education, experience, projects, skills, certifications } = body;

    if (!title) {
      return NextResponse.json({ error: 'Resume version title is required.' }, { status: 400 });
    }

    const version = new ResumeVersion({
      userId: user._id,
      title,
      targetRole,
      template: template || 'modern',
      personalInfo: personalInfo || {},
      summary: summary || '',
      education: education || [],
      experience: experience || [],
      projects: projects || [],
      skills: skills || [],
      certifications: certifications || [],
      isPrimary: false,
      lastScore: 0,
      analysisHistory: []
    });

    await version.save();
    return NextResponse.json({ version }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating resume version:', error);
    return NextResponse.json({ error: 'Failed to create resume version.' }, { status: 500 });
  }
}

export async function getResumeVersionById(req: any, context: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resume version ID structure.' }, { status: 400 });
    }

    const version = await ResumeVersion.findOne({ _id: id, userId: user._id });
    if (!version) {
      return NextResponse.json({ error: 'Resume version not found.' }, { status: 404 });
    }

    return NextResponse.json({ version });
  } catch (error: any) {
    console.error('Error fetching resume version by ID:', error);
    return NextResponse.json({ error: 'Failed to retrieve resume version.' }, { status: 500 });
  }
}

export async function updateResumeVersion(req: any, context: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resume version ID structure.' }, { status: 400 });
    }

    const body = await req.json();
    const { title, targetRole, template, personalInfo, summary, education, experience, projects, skills, certifications } = body;

    const version = await ResumeVersion.findOne({ _id: id, userId: user._id });
    if (!version) {
      return NextResponse.json({ error: 'Resume version not found.' }, { status: 404 });
    }

    if (title !== undefined) version.title = title;
    if (targetRole !== undefined) version.targetRole = targetRole;
    if (template !== undefined) version.template = template;
    if (personalInfo !== undefined) version.personalInfo = personalInfo;
    if (summary !== undefined) version.summary = summary;
    if (education !== undefined) version.education = education;
    if (experience !== undefined) version.experience = experience;
    if (projects !== undefined) version.projects = projects;
    if (skills !== undefined) version.skills = skills;
    if (certifications !== undefined) version.certifications = certifications;

    await version.save();
    return NextResponse.json({ version });
  } catch (error: any) {
    console.error('Error updating resume version:', error);
    return NextResponse.json({ error: 'Failed to update resume version.' }, { status: 500 });
  }
}

export async function deleteResumeVersion(req: any, context: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resume version ID structure.' }, { status: 400 });
    }

    const version = await ResumeVersion.findOneAndDelete({ _id: id, userId: user._id });
    if (!version) {
      return NextResponse.json({ error: 'Resume version not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Resume version deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting resume version:', error);
    return NextResponse.json({ error: 'Failed to delete resume version.' }, { status: 500 });
  }
}

export async function duplicateResumeVersion(req: any, context: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resume version ID structure.' }, { status: 400 });
    }

    const original = await ResumeVersion.findOne({ _id: id, userId: user._id });
    if (!original) {
      return NextResponse.json({ error: 'Resume version not found.' }, { status: 404 });
    }

    const copy = new ResumeVersion({
      userId: user._id,
      title: `${original.title} Copy`,
      targetRole: original.targetRole,
      template: original.template,
      personalInfo: original.personalInfo,
      summary: original.summary,
      education: original.education,
      experience: original.experience,
      projects: original.projects,
      skills: original.skills,
      certifications: original.certifications,
      isPrimary: false,
      lastScore: 0,
      analysisHistory: []
    });

    await copy.save();
    return NextResponse.json({ version: copy }, { status: 201 });
  } catch (error: any) {
    console.error('Error duplicating resume version:', error);
    return NextResponse.json({ error: 'Failed to duplicate resume version.' }, { status: 500 });
  }
}

export async function recalculateResumeScore(req: any, context: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resume version ID structure.' }, { status: 400 });
    }

    const version = await ResumeVersion.findOne({ _id: id, userId: user._id });
    if (!version) {
      return NextResponse.json({ error: 'Resume version not found.' }, { status: 404 });
    }

    // Cooldown check (30 seconds)
    const history = version.analysisHistory;
    if (history && history.length > 0) {
      const lastAnalysis = history[history.length - 1];
      const diffMs = Date.now() - new Date(lastAnalysis.analyzedAt).getTime();
      if (diffMs < 30000) {
        const remainingSeconds = Math.ceil((30000 - diffMs) / 1000);
        return NextResponse.json({
          error: `Recalculation cooldown active. Please wait ${remainingSeconds} seconds.`,
          cooldownRemaining: remainingSeconds
        }, { status: 429 });
      }
    }

    // Compile text
    const compiledText = compileResumeText(version);

    // Call Gemini
    const analysisResult = await analyzeResume(compiledText, version.targetRole);

    // Update version
    version.analysisHistory.push({
      score: analysisResult.atsScore,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      analyzedAt: new Date()
    });
    version.lastScore = analysisResult.atsScore;
    await version.save();

    return NextResponse.json({
      score: analysisResult.atsScore,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      version
    });
  } catch (error: any) {
    console.error('Error recalculating resume score:', error);
    return NextResponse.json({ error: 'Failed to recalculate resume score with AI.' }, { status: 500 });
  }
}

export async function setPrimaryResumeVersion(req: any, context: { params: { id: string } }) {
  try {
    const user = req.user;
    const { id } = context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid resume version ID structure.' }, { status: 400 });
    }

    const version = await ResumeVersion.findOne({ _id: id, userId: user._id });
    if (!version) {
      return NextResponse.json({ error: 'Resume version not found.' }, { status: 404 });
    }

    // Unset primary flag for other versions
    await ResumeVersion.updateMany(
      { userId: user._id, _id: { $ne: version._id } },
      { $set: { isPrimary: false } }
    );

    version.isPrimary = true;

    // Compile text
    const compiledText = compileResumeText(version);

    // Sync to main Resume schema
    let resume = await Resume.findOne({ userId: user._id });
    if (resume) {
      resume.extractedText = compiledText;
      resume.version += 1;
      resume.uploadedAt = new Date();
      if (!resume.fileUrl) {
        resume.fileUrl = `builder:${version._id}`;
      }
      await resume.save();
    } else {
      resume = new Resume({
        userId: user._id,
        fileUrl: `builder:${version._id}`,
        extractedText: compiledText,
        version: 1
      });
      await resume.save();
    }

    // Analyze compiled text
    const analysisResult = await analyzeResume(compiledText, version.targetRole);

    // Update ResumeAnalysis model
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

    // Update user profile fields (skills, experience, career level)
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

    // Recalculate job match scores
    await recalculateUserMatchScores(user._id);

    // Fetch average match score for trend tracking
    const matches = await JobMatch.find({ studentId: user._id });
    const avgMatchScore = matches.length > 0
      ? Math.round(matches.reduce((acc: number, m: any) => acc + m.matchScore, 0) / matches.length)
      : 0;

    // Append to version analysis history
    version.analysisHistory.push({
      score: analysisResult.atsScore,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      analyzedAt: new Date()
    });
    version.lastScore = analysisResult.atsScore;
    await version.save();

    await recordActivity(
      user._id,
      'Resume Analyzed',
      `Set resume version "${version.title}" as primary. AI Score: ${analysisResult.overallScore}/100. ATS Score: ${analysisResult.atsScore}/100.`,
      {
        atsScore: analysisResult.atsScore,
        overallScore: analysisResult.overallScore,
        avgMatchScore
      }
    );

    return NextResponse.json({
      message: 'Resume version set as primary and synchronized successfully.',
      version,
      analysis
    });

  } catch (error: any) {
    console.error('Error setting primary resume version:', error);
    return NextResponse.json({ error: 'Failed to set resume version as primary.' }, { status: 500 });
  }
}

export async function handleAiAssist(req: any) {
  try {
    const user = req.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const body = await req.json();
    const { action } = body;

    if (action === 'improve_bullet') {
      const { bulletPoint, jobTitle, targetRole } = body;
      if (!bulletPoint) {
        return NextResponse.json({ error: 'bulletPoint is required.' }, { status: 400 });
      }
      const result = await improveBulletPoint(bulletPoint, jobTitle, targetRole);
      return NextResponse.json({ improvedBulletPoint: result, result });
    } else if (action === 'rewrite_summary') {
      const { summary, jobTitle, tone, targetRole } = body;
      if (!summary) {
        return NextResponse.json({ error: 'summary is required.' }, { status: 400 });
      }
      const result = await rewriteSummary(summary, jobTitle, tone, targetRole);
      return NextResponse.json({ rewrittenSummary: result, result });
    } else if (action === 'suggest_verbs') {
      const { bulletPoint } = body;
      if (!bulletPoint) {
        return NextResponse.json({ error: 'bulletPoint is required.' }, { status: 400 });
      }
      const verbs = await suggestActionVerbs(bulletPoint);
      return NextResponse.json({ verbs, result: verbs });
    } else {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in AI assist route:', error);
    return NextResponse.json({ error: 'Failed to generate AI assist suggestions.' }, { status: 500 });
  }
}
