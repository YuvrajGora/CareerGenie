import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import User from '@/models/User';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import JobMatch from '@/models/JobMatch';
import Application from '@/models/Application';
import Job from '@/models/Job';
import { calculateMatchScore, calculateDetailedMatchScore, estimateExperience } from '@/services/matching';

// Load env variables
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  }
} catch (err) {
  // Ignore
}

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateAndRecalculate() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local!');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // 1. Fetch all student users
    const students = await User.find({ role: 'student' });
    console.log(`Found ${students.length} student users in database.`);

    for (const student of students) {
      console.log(`\nProcessing student: ${student.name} (${student.email})`);
      
      const resume = await Resume.findOne({ userId: student._id });
      const resumeText = resume ? resume.extractedText : '';
      
      let yearsOfExperience = 0;
      let careerLevel = 'Intern';

      // Check if they already have an analysis
      let analysis = null;
      if (resume) {
        analysis = await ResumeAnalysis.findOne({ resumeId: resume._id });
      }

      if (analysis && analysis.yearsOfExperience !== undefined) {
        yearsOfExperience = analysis.yearsOfExperience;
        careerLevel = analysis.careerLevel || 'Junior';
        console.log(`Found existing ResumeAnalysis with experience: ${yearsOfExperience} years (${careerLevel})`);
      } else {
        // Estimate experience from resume text
        yearsOfExperience = estimateExperience(resumeText);
        if (yearsOfExperience === 0) {
          careerLevel = 'Intern';
        } else if (yearsOfExperience < 3) {
          careerLevel = 'Junior';
        } else if (yearsOfExperience < 6) {
          careerLevel = 'Mid-Level';
        } else {
          careerLevel = 'Senior';
        }
        console.log(`Estimated experience from resume text: ${yearsOfExperience} years (${careerLevel})`);
      }

      // Update student profile with new fields if they aren't already set
      student.yearsOfExperience = yearsOfExperience;
      student.careerLevel = careerLevel;
      await student.save();
      console.log(`Updated User document for ${student.name}.`);

      // Update resume analysis fields if they are missing
      if (analysis) {
        let changed = false;
        if (analysis.yearsOfExperience === undefined) {
          analysis.yearsOfExperience = yearsOfExperience;
          changed = true;
        }
        if (!analysis.careerLevel) {
          analysis.careerLevel = careerLevel;
          changed = true;
        }
        if (changed) {
          await analysis.save();
          console.log(`Updated ResumeAnalysis document.`);
        }
      }

      // 2. Recalculate Job Matches
      const matches = await JobMatch.find({ studentId: student._id });
      console.log(`Found ${matches.length} existing JobMatches. Recalculating...`);
      for (const m of matches) {
        const job = await Job.findById(m.jobId);
        if (job) {
          const oldScore = m.matchScore;
          const detailed = calculateDetailedMatchScore(
            student.skills || [],
            yearsOfExperience,
            student.education || '',
            resumeText,
            job.requiredSkills || [],
            job.experience || 0,
            job.description || ''
          );
          m.matchScore = detailed.matchScore;
          m.skillsMatch = detailed.skillsMatch;
          m.experienceMatch = detailed.experienceMatch;
          m.educationMatch = detailed.educationMatch;
          await m.save();
          console.log(`- Job "${job.title}": Match score updated from ${oldScore}% to ${detailed.matchScore}%`);
        }
      }

      // 3. Recalculate Applications
      const applications = await Application.find({ studentId: student._id });
      console.log(`Found ${applications.length} existing Applications. Recalculating...`);
      for (const app of applications) {
        const job = await Job.findById(app.jobId);
        if (job) {
          const oldScore = app.matchScore;
          const score = calculateMatchScore(
            student.skills || [],
            yearsOfExperience,
            student.education || '',
            resumeText,
            job.requiredSkills || [],
            job.experience || 0,
            job.description || ''
          );
          app.matchScore = score;
          await app.save();
          console.log(`- Application for "${job.title}": Match score updated from ${oldScore}% to ${score}%`);
        }
      }
    }

    console.log('\nMigration and Recalculation complete!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAndRecalculate();
