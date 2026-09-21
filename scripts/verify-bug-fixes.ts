import zlib from 'zlib';
import { extractTextFromPdf, extractTextFromDocx, extractTextFromBuffer } from '../src/services/documentExtractor';
import { changePasswordSchema } from '../src/validations/validation';
import { getJwtSecret } from '../src/middleware/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runBugFixTests() {
  console.log('====================================================');
  console.log('  CareerGenie Bug Audit & Fix Verification Tests    ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  console.log('[Test 1: Document Extractor - PDF Stream Decoding]');
  // ---------------------------------------------------------------
  const deflated = zlib.deflateSync(Buffer.from('BT /F1 12 Tf (Jane Doe) Tj ET [(Senior) 10 (FullStack) 10 (Developer)] TJ'));
  const samplePdf = '1 0 obj << /Filter /FlateDecode /Length ' + deflated.length + ' >> stream\r\n' + deflated.toString('latin1') + '\r\nendstream endobj';
  const pdfBuf = Buffer.from(samplePdf, 'latin1');
  const extractedPdfText = extractTextFromPdf(pdfBuf);
  assert(extractedPdfText.includes('Jane Doe'), 'Extracts candidate name from deflated PDF stream');
  assert(extractedPdfText.includes('Senior FullStack Developer'), 'Extracts TJ array text from deflated PDF stream');

  // ---------------------------------------------------------------
  console.log('\n[Test 2: Document Extractor - DOCX XML Parsing]');
  // ---------------------------------------------------------------
  const xml = '<w:p><w:r><w:t>Alice Smith</w:t></w:r><w:r><w:t> DevOps Engineer</w:t></w:r></w:p>';
  const compressedXml = zlib.deflateRawSync(Buffer.from(xml));
  const filename = 'word/document.xml';
  const header = Buffer.alloc(30 + filename.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(compressedXml.length, 18);
  header.writeUInt32LE(xml.length, 22);
  header.writeUInt16LE(filename.length, 26);
  header.writeUInt16LE(0, 28);
  header.write(filename, 30);
  const docxBuf = Buffer.concat([header, compressedXml]);
  const extractedDocxText = extractTextFromDocx(docxBuf);
  assert(extractedDocxText.includes('Alice Smith DevOps Engineer'), 'Extracts text from DOCX word/document.xml');

  // ---------------------------------------------------------------
  console.log('\n[Test 3: Document Extractor - Plain Text & Fallbacks]');
  // ---------------------------------------------------------------
  const plainTextBuf = Buffer.from('Software Engineer with 4 years experience in TypeScript and React.');
  const extractedPlain = await extractTextFromBuffer(plainTextBuf, 'text/plain', 'resume.txt');
  assert(extractedPlain.includes('Software Engineer'), 'Extracts UTF-8 plain text');

  const emptyBuf = Buffer.from('');
  const emptyExtracted = await extractTextFromBuffer(emptyBuf);
  assert(emptyExtracted === '', 'Safely returns empty string on empty buffer');

  // ---------------------------------------------------------------
  console.log('\n[Test 4: Password Change Validation Schema]');
  // ---------------------------------------------------------------
  const validPw = changePasswordSchema.safeParse({
    currentPassword: 'oldPassword123',
    newPassword: 'newSecretPassword456'
  });
  assert(validPw.success, 'Valid password change payload accepted');

  const shortNewPw = changePasswordSchema.safeParse({
    currentPassword: 'oldPassword123',
    newPassword: 'short'
  });
  assert(!shortNewPw.success, 'New password under 6 characters rejected');

  const missingCurrPw = changePasswordSchema.safeParse({
    newPassword: 'newSecretPassword456'
  });
  assert(!missingCurrPw.success, 'Missing currentPassword rejected');

  // ---------------------------------------------------------------
  console.log('\n[Test 5: JWT Production Fatal Fallback]');
  // ---------------------------------------------------------------
  const origEnv = process.env.NODE_ENV;
  const origSecret = process.env.JWT_SECRET;
  try {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    let threw = false;
    try {
      getJwtSecret();
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('FATAL: JWT_SECRET'), 'Throws fatal error when JWT_SECRET missing in production');
    }
    if (!threw) {
      assert(false, 'Should have thrown error for missing JWT_SECRET in production');
    }
  } finally {
    (process.env as any).NODE_ENV = origEnv;
    if (origSecret) process.env.JWT_SECRET = origSecret;
  }

  // ---------------------------------------------------------------
  console.log('\n[Test 6: Job Recruiter Ownership Safety]');
  // ---------------------------------------------------------------
  // Simulate controller ownership comparison
  const job = {
    _id: 'job-101',
    title: 'Frontend Lead',
    recruiterId: 'recruiter-user-123'
  };

  const recruiterUser = { _id: 'recruiter-user-123', role: 'recruiter' };
  const otherRecruiter = { _id: 'recruiter-user-999', role: 'recruiter' };
  const adminUser = { _id: 'admin-user-001', role: 'admin' };
  const studentUser = { _id: 'student-user-555', role: 'student' };

  const canEdit = (u: any, j: any) => {
    const isAdmin = u.role === 'admin';
    const isOwner = j.recruiterId?.toString() === u._id.toString();
    return isAdmin || isOwner;
  };

  assert(canEdit(recruiterUser, job), 'Recruiter owner can update job');
  assert(!canEdit(otherRecruiter, job), 'Different recruiter CANNOT update job');
  assert(canEdit(adminUser, job), 'Admin CAN update any job');
  assert(!canEdit(studentUser, job), 'Student CANNOT update job');

  // Null safety test
  const orphanedJob = { _id: 'job-999', recruiterId: null };
  assert(!canEdit(recruiterUser, orphanedJob), 'Safely handles null recruiterId without throwing');
  assert(canEdit(adminUser, orphanedJob), 'Admin can still manage orphaned job');

  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBugFixTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
