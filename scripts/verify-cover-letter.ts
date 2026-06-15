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
import CoverLetter from '../src/models/CoverLetter';

async function verifyCoverLetter() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  try {
    const email = 'dashboard.student@example.com';
    let user = await User.findOne({ email });
    if (!user) {
      console.log('Test student not found. Creating one...');
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

    // Clean up any existing cover letter records for this test user/job
    await CoverLetter.deleteMany({ userId: user._id, jobId: job._id });
    console.log('Cleaned up previous CoverLetter cache for test user.');

    // Sign JWT Token
    console.log('Signing validation JWT token...');
    const token = jwt.sign(
      { userId: user._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Request 1: Fresh Generation for 'professional' tone
    console.log('Sending request to /api/cover-letter (Request 1 - Fresh Generation)...');
    const res1 = await fetch('http://localhost:3000/api/cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, tone: 'professional', refresh: false })
    });

    if (res1.status !== 200) {
      const text = await res1.text();
      console.error('✗ Cover Letter API request failed:', text);
      process.exit(1);
    }

    const data1 = await res1.json();
    console.log('First Run Response: OK');
    const letter1 = data1.coverLetter;

    if (!letter1) {
      throw new Error('Response is missing the coverLetter field');
    }
    if (!letter1.content || typeof letter1.content !== 'string') {
      throw new Error('Cover letter content is missing or not a string');
    }
    if (letter1.tone !== 'professional') {
      throw new Error(`Expected tone to be professional, got: ${letter1.tone}`);
    }
    console.log('✓ Cover Letter generated successfully.');
    console.log(`- Tone: ${letter1.tone}`);
    console.log(`- Length: ${letter1.content.length} chars`);
    console.log(`- Content Preview: "${letter1.content.substring(0, 100).replace(/\n/g, ' ')}..."`);

    // Request 2: Cache Hit for 'professional' tone
    console.log('Sending request to /api/cover-letter (Request 2 - Cache Hit)...');
    const start2 = Date.now();
    const res2 = await fetch('http://localhost:3000/api/cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, tone: 'professional', refresh: false })
    });
    const duration2 = Date.now() - start2;

    if (res2.status !== 200) {
      const text = await res2.text();
      throw new Error(`Second request failed with status ${res2.status}: ${text}`);
    }

    const data2 = await res2.json();
    const letter2 = data2.coverLetter;
    console.log(`Second Run Response: OK (Response took ${duration2}ms)`);

    if (letter1.generatedAt !== letter2.generatedAt) {
      throw new Error('Cache mismatch: generatedAt timestamps differ on non-refresh query.');
    }
    console.log('✓ Caching works: exact same generatedAt timestamp returned.');

    // Request 3: Force Regeneration for 'professional' tone
    console.log('Sending request to /api/cover-letter (Request 3 - Force Refresh)...');
    const res3 = await fetch('http://localhost:3000/api/cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, tone: 'professional', refresh: true })
    });

    if (res3.status !== 200) {
      const text = await res3.text();
      throw new Error(`Third request failed with status ${res3.status}: ${text}`);
    }

    const data3 = await res3.json();
    const letter3 = data3.coverLetter;
    console.log('Third Run Response: OK');

    if (letter1.generatedAt === letter3.generatedAt && new Date(letter1.generatedAt).getTime() === new Date(letter3.generatedAt).getTime()) {
      throw new Error('Force refresh failed: generatedAt timestamps are identical.');
    }
    console.log('✓ Regeneration works: new generatedAt timestamp returned.');

    // Request 4: Fresh Generation for different tone ('enthusiastic')
    console.log('Sending request to /api/cover-letter (Request 4 - Separate Tone)...');
    const res4 = await fetch('http://localhost:3000/api/cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({ jobId: job._id, tone: 'enthusiastic', refresh: false })
    });

    if (res4.status !== 200) {
      const text = await res4.text();
      throw new Error(`Fourth request failed with status ${res4.status}: ${text}`);
    }

    const data4 = await res4.json();
    const letter4 = data4.coverLetter;
    console.log('Fourth Run Response: OK');

    if (letter4.tone !== 'enthusiastic') {
      throw new Error(`Expected tone to be enthusiastic, got: ${letter4.tone}`);
    }

    // Verify both tones exist in db
    const allStored = await CoverLetter.find({ userId: user._id, jobId: job._id });
    if (allStored.length !== 2) {
      throw new Error(`Expected 2 stored letters, found: ${allStored.length}`);
    }
    console.log('✓ Multi-tone storage works: separate cache entries created per tone.');

    console.log('✓ COVER LETTER E2E INTEGRATION VERIFICATION PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('✗ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyCoverLetter();
