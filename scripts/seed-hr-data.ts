import fs from 'fs';
import path from 'path';

// Automatically load .env.local or .env if present in the workspace
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  try { process.loadEnvFile(envLocalPath); } catch {}
} else if (fs.existsSync(envPath)) {
  try { process.loadEnvFile(envPath); } catch {}
}

import { seedHrData } from '../src/services/hrSeedService';

console.log('--- Executing CareerGenie HR Seeding Script ---');

seedHrData()
  .then((results) => {
    console.log('--- HR Seeding Completed Successfully ---');
    console.log('Summary of Seeded Data:');
    console.log(`  • Employees:             ${results.employeesCount}`);
    console.log(`  • Telemetry Signals:     ${results.signalsCount}`);
    console.log(`  • Policy Documents:      ${results.policiesCount}`);
    console.log(`  • Onboarding Plans:      ${results.onboardingPlansCount}`);
    console.log(`  • Active Jobs:           ${results.jobsCount}`);
    console.log(`  • Candidates:            ${results.candidatesCount}`);
    console.log(`  • Applications:          ${results.applicationsCount}`);
    console.log(`  • Interview Evaluations: ${results.interviewEvaluationsCount}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('HR Seeding Failed:', err);
    process.exit(1);
  });
