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
import Job from '../src/models/Job';
import InterviewPrep from '../src/models/InterviewPrep';

async function verifyInterviewPrep() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  try {
    // Check if test student exists, else run setup similar to dashboard verification
    const email = 'dashboard.student@example.com';
    let user = await User.findOne({ email });
    if (!user) {
      console.log('Test student not found. Please run the dashboard verification script first or create one.');
      // Create user if not exists
      user = new User({
        name: 'Dashboard Test Student',
        email,
        password: 'Password123!',
        role: 'student',
        skills: ['TypeScript', 'React', 'Node.js', 'Next.js'],
        yearsOfExperience: 2,
        careerLevel: 'Junior'
      });
      await user.save();
      console.log('Created student user.');
    }

    let job = await Job.findOne({ company: 'Dashboard Verification Corp' });
    if (!job) {
      console.log('Test job not found. Creating one...');
      job = new Job({
        recruiterId: new mongoose.Types.ObjectId(),
        title: 'Full Stack Engineer',
        company: 'Dashboard Verification Corp',
        location: 'Remote',
        type: 'Full-time',
        requiredSkills: ['TypeScript', 'React', 'Node.js'],
        experienceRequired: 2,
        description: 'Looking for a solid mid-level full stack engineer.'
      });
      await job.save();
      console.log('Created job:', job._id);
    }

    // Clean up any existing interview prep records for this test to start fresh
    await InterviewPrep.deleteMany({ userId: user._id, jobId: job._id });
    console.log('Cleaned up previous InterviewPrep cache for test user.');

    // Sign JWT Token
    console.log('Signing validation JWT token...');
    const token = jwt.sign(
      { userId: user._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Call /api/interview-prep API (First Run: Fresh Generation / Mock Fallback)
    console.log('Sending request to /api/interview-prep (First Run)...');
    const res1 = await fetch('http://localhost:3000/api/interview-prep', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, refresh: false })
    });

    if (res1.status !== 200) {
      const text = await res1.text();
      console.error('✗ Interview Prep API request failed:', text);
      process.exit(1);
    }

    const data1 = await res1.json();
    console.log('First Run Response: OK');
    const prep1 = data1.interviewPrep;
    
    // Assert structure
    if (!prep1) {
      throw new Error('Response is missing the interviewPrep field');
    }
    console.log('✓ Retrieved InterviewPrep object.');
    console.log(`- Questions Count: ${prep1.questions.length}`);
    console.log(`- Weaknesses Count: ${prep1.weaknesses.length}`);

    // Assert Question structure
    if (!Array.isArray(prep1.questions) || prep1.questions.length < 10) {
      throw new Error(`Expected questions array of size >= 10, got: ${prep1.questions?.length}`);
    }

    prep1.questions.forEach((q: any, i: number) => {
      if (!q.question || typeof q.question !== 'string') throw new Error(`Question at index ${i} lacks question text.`);
      if (!q.suggestedAnswer || typeof q.suggestedAnswer !== 'string') throw new Error(`Question at index ${i} lacks suggestedAnswer.`);
      if (!q.recruiterIntent || typeof q.recruiterIntent !== 'string') throw new Error(`Question at index ${i} lacks recruiterIntent.`);
      if (!['technical', 'behavioral'].includes(q.type)) throw new Error(`Question at index ${i} has invalid type: ${q.type}`);
      if (!['beginner', 'intermediate', 'advanced'].includes(q.difficulty)) throw new Error(`Question at index ${i} has invalid difficulty: ${q.difficulty}`);
    });
    console.log('✓ All questions strictly match required schema interface.');

    // Assert Weaknesses structure
    if (!Array.isArray(prep1.weaknesses) || prep1.weaknesses.length === 0) {
      throw new Error(`Expected weaknesses array, got: ${prep1.weaknesses}`);
    }
    prep1.weaknesses.forEach((w: any, i: number) => {
      if (!w.skill || typeof w.skill !== 'string') throw new Error(`Weakness at index ${i} lacks skill name.`);
      if (!w.reason || typeof w.reason !== 'string') throw new Error(`Weakness at index ${i} lacks reason.`);
      if (!w.recommendation || typeof w.recommendation !== 'string') throw new Error(`Weakness at index ${i} lacks recommendation.`);
    });
    console.log('✓ All weaknesses strictly match structured weakness interface.');

    // Call /api/interview-prep API (Second Run: Cache Hit Test)
    console.log('Sending request to /api/interview-prep (Second Run - Cache Hit)...');
    const start2 = Date.now();
    const res2 = await fetch('http://localhost:3000/api/interview-prep', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, refresh: false })
    });
    const duration2 = Date.now() - start2;

    if (res2.status !== 200) {
      const text = await res2.text();
      throw new Error(`Second request failed with status ${res2.status}: ${text}`);
    }

    const data2 = await res2.json();
    const prep2 = data2.interviewPrep;
    console.log(`Second Run Response: OK (Response took ${duration2}ms)`);

    if (prep1.generatedAt !== prep2.generatedAt) {
      throw new Error('Cache mismatch: generatedAt timestamps differ on non-refresh query.');
    }
    console.log('✓ Caching works: exact same generatedAt timestamp returned.');

    // Call /api/interview-prep API (Third Run: Force Regeneration Test)
    console.log('Sending request to /api/interview-prep (Third Run - Force Refresh)...');
    const res3 = await fetch('http://localhost:3000/api/interview-prep', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, refresh: true })
    });

    if (res3.status !== 200) {
      const text = await res3.text();
      throw new Error(`Third request failed with status ${res3.status}: ${text}`);
    }

    const data3 = await res3.json();
    const prep3 = data3.interviewPrep;
    console.log('Third Run Response: OK');

    if (prep1.generatedAt === prep3.generatedAt && new Date(prep1.generatedAt).getTime() === new Date(prep3.generatedAt).getTime()) {
      throw new Error('Force refresh failed: generatedAt timestamps are identical.');
    }
    console.log('✓ Regeneration works: new generatedAt timestamp returned.');

    console.log('✓ INTERVIEW PREPARATION E2E INTEGRATION VERIFICATION PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('✗ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyInterviewPrep();
