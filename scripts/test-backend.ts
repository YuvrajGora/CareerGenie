import fs from 'fs';
import path from 'path';

// Simple manual parser for .env.local to avoid external package dependencies
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

import { analyzeResume } from '../src/services/gemini';
import { calculateMatchScore } from '../src/services/matching';

async function runTests() {
  console.log('=============================================');
  console.log('    CareerGenie Backend Verification Test    ');
  console.log('=============================================\n');

  // 1. Verify Gemini Resume Analysis and Mock Fallback
  console.log('[Test 1] Testing Resume Analysis Service...');
  const sampleResumeText = `
    Jane Doe
    Software Engineer
    Skills: TypeScript, JavaScript, React, Next.js, Node.js, SQL
    Experience: 2 years building responsive frontend layouts and API integrations.
    Education: Bachelor of Science in Computer Science
  `;

  try {
    const analysis = await analyzeResume(sampleResumeText);
    console.log('✓ Resume Analysis succeeded!');
    console.log(`- Overall Score: ${analysis.overallScore}/100`);
    console.log(`- ATS Score: ${analysis.atsScore}/100`);
    console.log(`- Strengths (Count): ${analysis.strengths.length}`);
    console.log(`- Weaknesses (Count): ${analysis.weaknesses.length}`);
    console.log(`- Extracted Skills: ${analysis.extractedSkills.join(', ')}`);
    console.log('---------------------------------------------\n');
  } catch (error) {
    console.error('✗ Resume Analysis failed:', error);
  }

  // 2. Verify Matching Algorithm Score
  console.log('[Test 2] Testing Matching Algorithm (60/20/10/10)...');
  
  const candidateSkills = ['TypeScript', 'React', 'Node.js', 'Git'];
  const candidateExperience = 2; // years
  const candidateEducation = 'Bachelor of Science in Computer Science';
  const candidateResumeText = 'Jane Doe is a software engineer experienced in React and Node.';

  const jobRequiredSkills = ['TypeScript', 'React', 'Node.js', 'Docker'];
  const jobRequiredExperience = 3; // years
  const jobDescription = 'We are looking for a Software Engineer. Requirements: Bachelor degree in Computer Science, React, TypeScript, Node.js experience preferred. Knowledge of Docker is a plus.';

  const score = calculateMatchScore(
    candidateSkills,
    candidateExperience,
    candidateEducation,
    candidateResumeText,
    jobRequiredSkills,
    jobRequiredExperience,
    jobDescription
  );

  console.log('✓ Matching Score Calculated!');
  console.log(`- Candidate Skills: ${candidateSkills.join(', ')}`);
  console.log(`- Required Skills: ${jobRequiredSkills.join(', ')}`);
  console.log(`- Required Experience: ${jobRequiredExperience} years | Candidate: ${candidateExperience} years`);
  console.log(`- Match Score: ${score}%`);
  console.log('=============================================');
}

runTests();
