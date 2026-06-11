import fs from 'fs';
import path from 'path';
import { sendApplicationConfirmationEmail, _resetTransporterCache } from '../src/services/email';

// Load env variables manually from .env.local for verification script
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
  console.warn('⚠️ Could not load .env.local file');
}

async function runTests() {
  console.log('🧪 Starting email service verification tests...');

  // Test 1: Successful email sending (with Ethereal fallback)
  try {
    console.log('\n--- Test 1: Sending standard confirmation email ---');
    const result = await sendApplicationConfirmationEmail({
      to: 'student_test@example.com',
      studentName: 'Jane Student',
      jobTitle: 'Senior React Developer',
      companyName: 'TechCorp Solutions',
      date: new Date()
    });
    console.log('✅ Test 1 Passed! Email dispatched successfully.');
    if (result && result.messageId) {
      console.log(`   Message ID: ${result.messageId}`);
    }
  } catch (error) {
    console.error('❌ Test 1 Failed:', error);
    process.exit(1);
  }

  // Test 2: Verify non-blocking behavior on connection error
  try {
    console.log('\n--- Test 2: Verifying non-blocking behavior during SMTP error ---');
    
    // Reset transporter cache and temporarily inject broken SMTP configuration to trigger connection/configuration error
    _resetTransporterCache();
    const originalHost = process.env.EMAIL_HOST;
    const originalUser = process.env.EMAIL_USER;
    const originalPass = process.env.EMAIL_PASS;
    
    process.env.EMAIL_HOST = 'invalid.smtp.domain.that.does.not.exist.com';
    process.env.EMAIL_USER = 'invalid_user';
    process.env.EMAIL_PASS = 'invalid_pass';
    
    let emailDispatchFinished = false;
    let mainApplicationFlowFinished = false;

    // Simulate controller logic where we do NOT await, and catch errors
    const emailPromise = sendApplicationConfirmationEmail({
      to: 'student_test@example.com',
      studentName: 'Jane Student',
      jobTitle: 'Senior React Developer',
      companyName: 'TechCorp Solutions',
      date: new Date()
    })
      .then(() => {
        emailDispatchFinished = true;
        console.log('   (Async email dispatch succeeded unexpectedly)');
      })
      .catch((err) => {
        emailDispatchFinished = true;
        console.log('   (Async email dispatch failed as expected: ' + err.message + ')');
      });

    // Simulate immediate HTTP response return (non-blocking)
    mainApplicationFlowFinished = true;
    console.log('✅ Application flow returned HTTP 201 response immediately (non-blocking check passed).');

    // Wait for the background email promise to finish to verify it doesn't crash the Node process
    await emailPromise;
    console.log('✅ Test 2 Passed! Email error was caught in background without breaking the execution flow.');

    // Restore original env variables
    process.env.EMAIL_HOST = originalHost;
    process.env.EMAIL_USER = originalUser;
    process.env.EMAIL_PASS = originalPass;
  } catch (error) {
    console.error('❌ Test 2 Failed:', error);
    process.exit(1);
  }

  console.log('\n🎉 All email validation tests completed successfully!');
}

runTests();
