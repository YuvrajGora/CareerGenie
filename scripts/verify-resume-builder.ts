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
import ResumeVersion from '../src/models/ResumeVersion';
import Resume from '../src/models/Resume';
import ResumeAnalysis from '../src/models/ResumeAnalysis';

async function verifyResumeBuilder() {
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

    // Clean up any existing resume versions for this student
    console.log('Cleaning up previous Resume Versions...');
    await ResumeVersion.deleteMany({ userId: user._id });

    // Sign JWT Token
    console.log('Signing validation JWT token...');
    const token = jwt.sign(
      { userId: user._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cookie': `token=${token}`
    };

    // 1. Create a new Resume Version
    console.log('\n--- Step 1: Create Resume Version ---');
    const resCreate = await fetch('http://localhost:3000/api/resume-versions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Initial React Resume',
        targetRole: 'React Developer',
        template: 'modern',
        personalInfo: {
          name: 'Dashboard Test Student',
          email: 'dashboard.student@example.com',
          phone: '123-456-7890'
        }
      })
    });

    if (resCreate.status !== 201) {
      const text = await resCreate.text();
      throw new Error(`Create Resume Version failed: ${text}`);
    }

    const dataCreate = await resCreate.json();
    const createdVersion = dataCreate.version;
    console.log('✓ Resume version created successfully.');
    console.log(`- Title: ${createdVersion.title}`);
    console.log(`- Target Role: ${createdVersion.targetRole}`);
    console.log(`- Template: ${createdVersion.template}`);
    console.log(`- isPrimary: ${createdVersion.isPrimary}`);
    console.log(`- lastScore: ${createdVersion.lastScore}`);

    if (createdVersion.isPrimary !== false || createdVersion.lastScore !== 0) {
      throw new Error('Expected default flags isPrimary=false and lastScore=0');
    }

    // 2. Update Resume Version Fields
    console.log('\n--- Step 2: Update Resume Version ---');
    const resUpdate = await fetch(`http://localhost:3000/api/resume-versions/${createdVersion._id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        summary: 'Experienced web developer focusing on React and modern CSS layout engines.',
        skills: ['React', 'TypeScript', 'Node.js', 'Tailwind CSS'],
        experience: [{
          company: 'CareerGenie',
          position: 'Software Intern',
          location: 'New York, NY',
          startDate: 'May 2024',
          endDate: 'Present',
          current: true,
          description: [
            'Spearheaded transition from legacy CSS to Tailwind utility classes.',
            'Optimized API response latency by 35% through query caching.'
          ]
        }]
      })
    });

    if (resUpdate.status !== 200) {
      const text = await resUpdate.text();
      throw new Error(`Update Resume Version failed: ${text}`);
    }

    const dataUpdate = await resUpdate.json();
    const updatedVersion = dataUpdate.version;
    console.log('✓ Resume version updated successfully.');
    console.log(`- Summary: "${updatedVersion.summary}"`);
    console.log(`- Experience count: ${updatedVersion.experience?.length}`);

    // 3. Duplicate Resume Version
    console.log('\n--- Step 3: Duplicate Resume Version ---');
    const resDuplicate = await fetch(`http://localhost:3000/api/resume-versions/${createdVersion._id}/duplicate`, {
      method: 'POST',
      headers
    });

    if (resDuplicate.status !== 201) {
      const text = await resDuplicate.text();
      throw new Error(`Duplicate Resume Version failed: ${text}`);
    }

    const dataDuplicate = await resDuplicate.json();
    const duplicated = dataDuplicate.version;
    console.log('✓ Resume version duplicated successfully.');
    console.log(`- Duplicated Title: ${duplicated.title}`);
    console.log(`- Duplicated Target Role: ${duplicated.targetRole}`);
    console.log(`- Duplicated isPrimary: ${duplicated.isPrimary}`);
    console.log(`- Duplicated lastScore: ${duplicated.lastScore}`);

    if (duplicated.title !== `${updatedVersion.title} Copy`) {
      throw new Error(`Expected title "${updatedVersion.title} Copy", got: ${duplicated.title}`);
    }
    if (duplicated.isPrimary !== false || duplicated.lastScore !== 0) {
      throw new Error('Duplicated resume should reset isPrimary to false and lastScore to 0');
    }
    if (duplicated.analysisHistory.length !== 0) {
      throw new Error('Duplicated resume should clear analysis history');
    }

    // 4. Recalculate Score with AI (first run)
    console.log('\n--- Step 4: Recalculate Score with AI ---');
    const resRecalc1 = await fetch(`http://localhost:3000/api/resume-versions/${createdVersion._id}/recalculate`, {
      method: 'POST',
      headers
    });

    if (resRecalc1.status !== 200) {
      const text = await resRecalc1.text();
      throw new Error(`Recalculate Score failed: ${text}`);
    }

    const dataRecalc1 = await resRecalc1.json();
    console.log('✓ Recalculation response successful.');
    console.log(`- Score: ${dataRecalc1.score}`);
    console.log(`- Strengths: ${dataRecalc1.strengths?.slice(0, 2).join(', ')}`);
    console.log(`- Weaknesses: ${dataRecalc1.weaknesses?.slice(0, 2).join(', ')}`);

    const savedAfterRecalc = dataRecalc1.version;
    if (savedAfterRecalc.lastScore !== dataRecalc1.score) {
      throw new Error(`Expected lastScore to match calculation score: ${dataRecalc1.score}`);
    }
    if (savedAfterRecalc.analysisHistory.length !== 1) {
      throw new Error(`Expected analysisHistory to contain 1 entry, found: ${savedAfterRecalc.analysisHistory.length}`);
    }

    // 5. Verify Cooldown protection (second run within 30s)
    console.log('\n--- Step 5: Test Recalculation Cooldown (should fail with 429) ---');
    const resRecalc2 = await fetch(`http://localhost:3000/api/resume-versions/${createdVersion._id}/recalculate`, {
      method: 'POST',
      headers
    });

    console.log(`- Recalculate request returned status code: ${resRecalc2.status}`);
    if (resRecalc2.status !== 429) {
      throw new Error('Expected 429 status code for rapid recalculation request');
    }

    const dataRecalc2 = await resRecalc2.json();
    console.log(`✓ Cooldown active: "${dataRecalc2.error}"`);
    console.log(`- Cooldown remaining: ${dataRecalc2.cooldownRemaining}s`);

    // 6. Set Primary Resume Version
    console.log('\n--- Step 6: Set Resume Version as Primary ---');
    const resSetPrimary = await fetch(`http://localhost:3000/api/resume-versions/${createdVersion._id}/set-primary`, {
      method: 'POST',
      headers
    });

    if (resSetPrimary.status !== 200) {
      const text = await resSetPrimary.text();
      throw new Error(`Set Primary failed: ${text}`);
    }

    const dataPrimary = await resSetPrimary.json();
    console.log('✓ Primary sync completed successfully.');
    console.log(`- Version Title: ${dataPrimary.version.title}`);
    console.log(`- Version isPrimary: ${dataPrimary.version.isPrimary}`);

    if (dataPrimary.version.isPrimary !== true) {
      throw new Error('Expected isPrimary flag to be true on the updated version');
    }

    // Check that primary Resume model got updated
    const mainResume = await Resume.findOne({ userId: user._id });
    if (!mainResume) {
      throw new Error('Expected main Resume record to be created/updated');
    }
    console.log('✓ Main Resume record is present.');
    console.log(`- FileUrl indicates builder sync: ${mainResume.fileUrl}`);
    console.log(`- Main Resume text length: ${mainResume.extractedText?.length || 0} characters`);

    // Check that ResumeAnalysis model got synced
    const mainAnalysis = await ResumeAnalysis.findOne({ resumeId: mainResume._id });
    if (!mainAnalysis) {
      throw new Error('Expected ResumeAnalysis record to be synced');
    }
    console.log('✓ Main ResumeAnalysis is present.');
    console.log(`- Main Overall Score: ${mainAnalysis.overallScore}`);
    console.log(`- Main ATS Score: ${mainAnalysis.atsScore}`);
    console.log(`- Extracted Skills: ${mainAnalysis.missingSkills?.join(', ')}`);

    // 7. Verify AI Assist Tools
    console.log('\n--- Step 7: Verify AI Assist Endpoint ---');
    
    // 7.1 Rewrite Summary
    console.log('Sending request for summary rewrite...');
    const resAssistSummary = await fetch('http://localhost:3000/api/resume-versions/ai-assist', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'rewrite_summary',
        summary: 'Experienced web developer focusing on React and modern CSS layout engines.',
        targetRole: 'React Developer',
        tone: 'enthusiastic'
      })
    });

    if (resAssistSummary.status !== 200) {
      const text = await resAssistSummary.text();
      throw new Error(`Rewrite Summary failed: ${text}`);
    }
    const dataAssistSummary = await resAssistSummary.json();
    console.log('✓ AI Rewrite Summary success.');
    console.log(`- Rewritten text: "${dataAssistSummary.rewrittenSummary}"`);

    // 7.2 Improve Bullet Point
    console.log('Sending request for bullet point improvement...');
    const resAssistBullet = await fetch('http://localhost:3000/api/resume-versions/ai-assist', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'improve_bullet',
        bulletPoint: 'Spearheaded transition from legacy CSS to Tailwind utility classes.',
        jobTitle: 'Software Intern',
        targetRole: 'React Developer'
      })
    });

    if (resAssistBullet.status !== 200) {
      const text = await resAssistBullet.text();
      throw new Error(`Improve Bullet Point failed: ${text}`);
    }
    const dataAssistBullet = await resAssistBullet.json();
    console.log('✓ AI Improve Bullet Point success.');
    console.log(`- Improved bullet: "${dataAssistBullet.improvedBulletPoint}"`);

    // 7.3 Suggest Action Verbs
    console.log('Sending request for action verbs suggestions...');
    const resAssistVerbs = await fetch('http://localhost:3000/api/resume-versions/ai-assist', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'suggest_verbs',
        bulletPoint: 'Spearheaded transition from legacy CSS to Tailwind utility classes.'
      })
    });

    if (resAssistVerbs.status !== 200) {
      const text = await resAssistVerbs.text();
      throw new Error(`Suggest Action Verbs failed: ${text}`);
    }
    const dataAssistVerbs = await resAssistVerbs.json();
    console.log('✓ AI Suggest Action Verbs success.');
    console.log(`- Suggested verbs: ${dataAssistVerbs.verbs?.join(', ')}`);

    console.log('\n=============================================================');
    console.log('✓ RESUME BUILDER E2E INTEGRATION VERIFICATION PASSED SUCCESSFULLY!');
    console.log('=============================================================');

  } catch (error) {
    console.error('✗ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyResumeBuilder();
