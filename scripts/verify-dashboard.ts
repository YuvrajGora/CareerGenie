import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// 1. Load env variables from .env.local
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
  console.warn('Could not parse .env.local file', err);
}

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'cg_dev_secret_jwt_token_98234751923487056';

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env.local!');
  process.exit(1);
}

// 2. Import Models
import User from '../src/models/User';
import Resume from '../src/models/Resume';
import ResumeAnalysis from '../src/models/ResumeAnalysis';
import UserActivity from '../src/models/UserActivity';
import Job from '../src/models/Job';
import JobMatch from '../src/models/JobMatch';
import Application from '../src/models/Application';
import bcrypt from 'bcryptjs';

async function verifyDashboard() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  try {
    const email = 'dashboard.student@example.com';
    
    // 3. Clean up existing test records
    console.log('Cleaning up existing verification records...');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const uid = existingUser._id;
      await ResumeAnalysis.deleteMany({ resumeId: { $in: await Resume.find({ userId: uid }).distinct('_id') } });
      await Resume.deleteMany({ userId: uid });
      await UserActivity.deleteMany({ userId: uid });
      await JobMatch.deleteMany({ studentId: uid });
      await Application.deleteMany({ studentId: uid });
      await User.deleteOne({ _id: uid });
    }
    
    // Cleanup any existing test job
    await Job.deleteMany({ company: 'Dashboard Verification Corp' });

    // 4. Create a student user
    console.log('Creating student user...');
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const user = new User({
      name: 'Dashboard Test Student',
      email,
      password: hashedPassword,
      role: 'student',
      skills: ['TypeScript', 'React', 'Node.js', 'Next.js'],
      yearsOfExperience: 2,
      careerLevel: 'Junior'
    });
    await user.save();
    console.log('✓ Student created with ID:', user._id);

    // 5. Create test jobs and matches
    console.log('Creating matching job postings...');
    const recruiter = await User.findOne({ role: 'recruiter' });
    const recruiterId = recruiter ? recruiter._id : new mongoose.Types.ObjectId();

    const job = new Job({
      recruiterId,
      title: 'Full Stack Engineer',
      company: 'Dashboard Verification Corp',
      location: 'Remote',
      type: 'Full-time',
      requiredSkills: ['TypeScript', 'React', 'Node.js'],
      experienceRequired: 2,
      description: 'Looking for a solid mid-level full stack engineer.'
    });
    await job.save();

    const jobMatch = new JobMatch({
      studentId: user._id,
      jobId: job._id,
      matchScore: 88,
      skillsMatch: 85,
      experienceMatch: 90,
      educationMatch: 90,
      calculatedAt: new Date()
    });
    await jobMatch.save();
    console.log('✓ Job and JobMatch records created.');

    // 6. Create resume and analysis records
    console.log('Creating resume and resume analysis reports...');
    const resume = new Resume({
      userId: user._id,
      fileUrl: 'https://example.com/resumes/verify_resume.pdf',
      extractedText: 'Extracted full stack developer details for Dashboard Test Student.',
      version: 1
    });
    await resume.save();

    const analysis = new ResumeAnalysis({
      resumeId: resume._id,
      overallScore: 82,
      atsScore: 85,
      strengths: ['Strong React skills', 'Solid TypeScript background'],
      weaknesses: ['Missing Cloud architecture experience'],
      missingSkills: ['AWS', 'Docker'],
      suggestions: ['Add containerization projects'],
      yearsOfExperience: 2,
      careerLevel: 'Junior'
    });
    await analysis.save();
    console.log('✓ Resume & Analysis created.');

    // 7. Seed activities
    console.log('Logging user activities...');
    const act1 = new UserActivity({
      userId: user._id,
      activityType: 'Profile Updated',
      details: 'Updated skills and years of experience fields.',
      createdAt: new Date(Date.now() - 3600000 * 2) // 2 hours ago
    });
    await act1.save();

    const act2 = new UserActivity({
      userId: user._id,
      activityType: 'Resume Uploaded',
      details: 'Uploaded resume draft v1.',
      createdAt: new Date(Date.now() - 3600000 * 1.5) // 1.5 hours ago
    });
    await act2.save();

    const act3 = new UserActivity({
      userId: user._id,
      activityType: 'Resume Analyzed',
      details: 'Resume analysis finished with ATS score: 85.',
      metadata: { atsScore: 85, avgMatchScore: 88 },
      createdAt: new Date(Date.now() - 3600000 * 1) // 1 hour ago
    });
    await act3.save();
    console.log('✓ Activities logged successfully.');

    // 8. Sign JWT Token
    console.log('Signing validation JWT token...');
    const token = jwt.sign(
      { userId: user._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 9. Call Local Dashboard Endpoint
    console.log('Sending request to /api/dashboard...');
    const response = await fetch('http://localhost:3000/api/dashboard', {
      method: 'GET',
      headers: {
        'Cookie': `token=${token}`,
        'Authorization': `Bearer ${token}`
      }
    });

    const status = response.status;
    console.log(`Response status: ${status}`);

    if (status !== 200) {
      const text = await response.text();
      console.error('✗ Dashboard verification request failed:', text);
      process.exit(1);
    }

    const data = await response.json();
    console.log('\n=========================================');
    console.log('    AGGREGATED DASHBOARD RESPONSE DATA   ');
    console.log('=========================================');
    console.log('Metrics:', JSON.stringify(data.metrics, null, 2));
    console.log('\nAI Recommendations:', JSON.stringify(data.recommendations, null, 2));
    console.log('\nActivities (Count):', data.activities.length);
    data.activities.forEach((act: any, idx: number) => {
      console.log(`  ${idx + 1}. [${act.type}] ${act.description} (${act.timestampLabel})`);
    });
    console.log('\nMarket Insights:', JSON.stringify(data.marketInsights, null, 2));
    console.log('\nRecommended Jobs (Count):', data.jobs.length);
    data.jobs.forEach((job: any) => {
      console.log(`  - ${job.title} at ${job.company} (${job.matchScore}% Match)`);
    });
    console.log('=========================================\n');

    // 10. Asserts
    if (data.metrics.resumeScore !== 82) {
      throw new Error(`Expected resumeScore to be 82, got ${data.metrics.resumeScore}`);
    }
    if (data.metrics.jobsMatched !== 1) {
      throw new Error(`Expected jobsMatched to be 1, got ${data.metrics.jobsMatched}`);
    }
    if (data.metrics.interviewChances !== 'High') {
      throw new Error(`Expected interviewChances to be 'High', got ${data.metrics.interviewChances}`);
    }
    if (data.activities.length < 3) {
      throw new Error(`Expected at least 3 activities, got ${data.activities.length}`);
    }
    console.log('✓ E2E DASHBOARD INTEGRATION VERIFICATION PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('✗ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyDashboard();
