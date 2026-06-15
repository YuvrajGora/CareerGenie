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
import RateLimit from '../src/models/RateLimit';

async function verifyRateLimiting() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  try {
    const email = 'ratelimit.student@example.com';
    let user = await User.findOne({ email });
    if (!user) {
      console.log('Test student not found. Creating one...');
      user = new User({
        name: 'Rate Limit Student',
        email,
        password: 'Password123!',
        role: 'student',
        skills: ['TypeScript', 'React'],
        yearsOfExperience: 1,
        careerLevel: 'Junior'
      });
      await user.save();
      console.log('Created student user.');
    }

    let job = await Job.findOne({ company: 'Rate Limit Corp' });
    if (!job) {
      console.log('Test job not found. Creating one...');
      job = new Job({
        recruiterId: new mongoose.Types.ObjectId(),
        title: 'Software Developer',
        company: 'Rate Limit Corp',
        location: 'Remote',
        type: 'Full-time',
        requiredSkills: ['TypeScript', 'React'],
        experienceRequired: 1,
        description: 'React developer job for testing rate limit.'
      });
      await job.save();
      console.log('Created job:', job._id);
    }

    // Clear rate limits for this user/key
    const keyPattern = `cover_letter:${user._id.toString()}:/api/cover-letter`;
    await RateLimit.deleteOne({ key: keyPattern });
    console.log(`Cleared previous rate limit records for key: ${keyPattern}`);

    // Sign JWT Token
    console.log('Signing validation JWT token...');
    const token = jwt.sign(
      { userId: user._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('Starting sequential requests (limit is 10)...');
    
    // We will send 12 requests. 10 should succeed (cache-hits), 11th and 12th should be 429.
    for (let i = 1; i <= 12; i++) {
      const start = Date.now();
      const res = await fetch('http://localhost:3000/api/cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `token=${token}`
        },
        body: JSON.stringify({ jobId: job._id, tone: 'professional', refresh: false })
      });
      const duration = Date.now() - start;
      const status = res.status;
      
      const limitHeader = res.headers.get('X-RateLimit-Limit');
      const remainingHeader = res.headers.get('X-RateLimit-Remaining');
      const resetHeader = res.headers.get('X-RateLimit-Reset');
      const retryAfterHeader = res.headers.get('Retry-After');

      console.log(`Request #${i}: Status = ${status} (${duration}ms) | Limit: ${limitHeader}, Remaining: ${remainingHeader}, Reset: ${resetHeader}, Retry-After: ${retryAfterHeader}`);

      if (i <= 10) {
        if (status !== 200) {
          const body = await res.text();
          throw new Error(`Expected status 200 for request #${i}, but got ${status}. Body: ${body}`);
        }
      } else {
        if (status !== 429) {
          const body = await res.text();
          throw new Error(`Expected status 429 (Rate Limited) for request #${i}, but got ${status}. Body: ${body}`);
        }
        console.log(`✓ Request #${i} correctly blocked with 429 Too Many Requests.`);
      }
    }

    console.log('✓ RATE LIMITING VERIFICATION PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('✗ Rate limiting verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyRateLimiting();
