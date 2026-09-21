import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  signToken,
  verifyTokenWithRole,
  withAuth,
  ROLE_COOKIE_MAP,
  ROLE_HEADER_NAME,
  UserRole,
} from '../src/middleware/auth';
import { register, login, logout } from '../src/controllers/authController';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${testName}${details ? ' - ' + details : ''}`);
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('  CareerGenie Multi-Tab Auth Verification Test Suite ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // TEST A & B: Independent Token Signing & Cookie Map Identification
  // ---------------------------------------------------------------
  console.log('[Phase 1: Cookie Configuration & Role Names]');
  assert(ROLE_COOKIE_MAP.student === 'cg_student_token', 'Student cookie is cg_student_token');
  assert(ROLE_COOKIE_MAP.recruiter === 'cg_recruiter_token', 'Recruiter cookie is cg_recruiter_token');
  assert(ROLE_COOKIE_MAP.admin === 'cg_admin_token', 'Admin cookie is cg_admin_token');

  const studentJwt = signToken({ userId: 'student_user_123', role: 'student' });
  const recruiterJwt = signToken({ userId: 'recruiter_user_456', role: 'recruiter' });
  const adminJwt = signToken({ userId: 'admin_user_789', role: 'admin' });

  assert(Boolean(studentJwt && recruiterJwt && adminJwt), 'All role JWTs signed successfully');

  // ---------------------------------------------------------------
  // TEST C & D: Deterministic Resolution with Both Cookies Present
  // ---------------------------------------------------------------
  console.log('\n[Phase 2: Multi-Tab Coexistence & Header Resolution]');
  // Simulate a browser cookie jar holding BOTH cookies simultaneously
  const dualCookieHeader = `cg_student_token=${studentJwt}; cg_recruiter_token=${recruiterJwt}`;

  // Tab A (Student tab): passes X-CareerGenie-Role: student
  const tabAReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'student',
    },
  });
  const tabAResult = verifyTokenWithRole(tabAReq);
  assert(
    tabAResult !== null && tabAResult.decoded.userId === 'student_user_123' && tabAResult.decoded.role === 'student',
    'TEST A/C: Tab A with role header "student" deterministically resolves Student session'
  );

  // Tab B (Recruiter tab): passes X-CareerGenie-Role: recruiter
  const tabBReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'recruiter',
    },
  });
  const tabBResult = verifyTokenWithRole(tabBReq);
  assert(
    tabBResult !== null && tabBResult.decoded.userId === 'recruiter_user_456' && tabBResult.decoded.role === 'recruiter',
    'TEST B/D: Tab B with role header "recruiter" deterministically resolves Recruiter session'
  );

  // ---------------------------------------------------------------
  // TEST E: Refresh Simulation for Each Tab
  // ---------------------------------------------------------------
  console.log('\n[Phase 3: Tab Refresh Simulation]');
  // When Tab A refreshes, sessionStorage restores activeRole = 'student'
  const refreshStudentReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'student',
    },
  });
  const refreshStudentRes = verifyTokenWithRole(refreshStudentReq);
  assert(
    refreshStudentRes?.decoded.role === 'student',
    'TEST E1: Tab A refresh preserves Student session'
  );

  // When Tab B refreshes, sessionStorage restores activeRole = 'recruiter'
  const refreshRecruiterReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'recruiter',
    },
  });
  const refreshRecruiterRes = verifyTokenWithRole(refreshRecruiterReq);
  assert(
    refreshRecruiterRes?.decoded.role === 'recruiter',
    'TEST E2: Tab B refresh preserves Recruiter session'
  );

  // ---------------------------------------------------------------
  // TEST: Endpoint with Exactly One Allowed Role (No header provided)
  // ---------------------------------------------------------------
  console.log('\n[Phase 4: Single-Role Inferred Resolution]');
  // A student-only endpoint (/api/resumes) accessed without header should infer cg_student_token
  const singleStudentReq = new NextRequest('http://localhost:3000/api/resumes', {
    headers: { cookie: dualCookieHeader },
  });
  const singleStudentRes = verifyTokenWithRole(singleStudentReq, ['student']);
  assert(
    singleStudentRes?.decoded.role === 'student',
    'Infers and selects cg_student_token when allowedRoles is exactly ["student"]'
  );

  // A recruiter-only endpoint (/api/jobs) accessed without header should infer cg_recruiter_token
  const singleRecruiterReq = new NextRequest('http://localhost:3000/api/jobs', {
    headers: { cookie: dualCookieHeader },
  });
  const singleRecruiterRes = verifyTokenWithRole(singleRecruiterReq, ['recruiter']);
  assert(
    singleRecruiterRes?.decoded.role === 'recruiter',
    'Infers and selects cg_recruiter_token when allowedRoles is exactly ["recruiter"]'
  );

  // ---------------------------------------------------------------
  // TEST: No Guessing / No Blind Fallback on Multi-Role Endpoints
  // ---------------------------------------------------------------
  console.log('\n[Phase 5: Deterministic Rejection Without Role Header]');
  // Multi-role endpoint (/api/applications) without role header must NOT guess
  const multiRoleNoHeaderReq = new NextRequest('http://localhost:3000/api/applications', {
    headers: { cookie: dualCookieHeader },
  });
  const multiRoleNoHeaderRes = verifyTokenWithRole(multiRoleNoHeaderReq, ['student', 'recruiter']);
  assert(
    multiRoleNoHeaderRes === null,
    'Rejects request without role header on multi-role endpoint (zero guessing)'
  );

  // ---------------------------------------------------------------
  // TEST H: Role Spoofing Prevention
  // ---------------------------------------------------------------
  console.log('\n[Phase 6: Security - Role Spoofing Prevention]');
  // Case 1: Student cookie only in jar, but client passes X-CareerGenie-Role: recruiter
  const spoofReq = new NextRequest('http://localhost:3000/api/recruiter/create-job', {
    headers: {
      cookie: `cg_student_token=${studentJwt}`,
      [ROLE_HEADER_NAME]: 'recruiter',
    },
  });
  const spoofRes = verifyTokenWithRole(spoofReq);
  assert(
    spoofRes === null,
    'TEST H1: Claiming "recruiter" with only cg_student_token present is rejected (missing recruiter cookie)'
  );

  // Case 2: Invalid/unrecognized role header value
  const invalidRoleReq = new NextRequest('http://localhost:3000/api/jobs', {
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'super_admin_bypass',
    },
  });
  const invalidRoleRes = verifyTokenWithRole(invalidRoleReq);
  assert(
    invalidRoleRes === null,
    'TEST H2: Unrecognized role header value is rejected deterministically'
  );

  // ---------------------------------------------------------------
  // TEST F & G: Independent Role Logout
  // ---------------------------------------------------------------
  console.log('\n[Phase 7: Independent Logout]');
  // Student logout:
  const studentLogoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'student',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ role: 'student' }),
  });
  const studentLogoutRes = await logout(studentLogoutReq);
  const studentSetCookie = studentLogoutRes.headers.get('set-cookie') || '';

  assert(
    studentSetCookie.includes('cg_student_token=') &&
    (studentSetCookie.includes('Max-Age=0') || studentSetCookie.includes('expires=Thu, 01 Jan 1970')),
    'TEST F1: Student logout expires cg_student_token'
  );
  assert(
    !studentSetCookie.includes('cg_recruiter_token='),
    'TEST F2: Student logout does NOT expire cg_recruiter_token'
  );

  // Recruiter logout:
  const recruiterLogoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: {
      cookie: dualCookieHeader,
      [ROLE_HEADER_NAME]: 'recruiter',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ role: 'recruiter' }),
  });
  const recruiterLogoutRes = await logout(recruiterLogoutReq);
  const recruiterSetCookie = recruiterLogoutRes.headers.get('set-cookie') || '';

  assert(
    recruiterSetCookie.includes('cg_recruiter_token=') &&
    (recruiterSetCookie.includes('Max-Age=0') || recruiterSetCookie.includes('expires=Thu, 01 Jan 1970')),
    'TEST G1: Recruiter logout expires cg_recruiter_token'
  );
  assert(
    !recruiterSetCookie.includes('cg_student_token='),
    'TEST G2: Recruiter logout does NOT expire cg_student_token'
  );

  // ---------------------------------------------------------------
  // TEST I: Registration Privilege Escalation Prevention
  // ---------------------------------------------------------------
  console.log('\n[Phase 8: Registration Security]');
  const adminRegReq = new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Malicious Attacker',
      email: 'attacker@example.com',
      password: 'password123',
      role: 'admin',
    }),
  });
  const adminRegRes = await register(adminRegReq);
  assert(
    adminRegRes.status === 403 || adminRegRes.status === 400,
    'TEST I: Public registration attempt with role="admin" is rejected with 403/400'
  );

  // ---------------------------------------------------------------
  // TEST SUMMARY
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Test Results: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error running verification suite:', err);
  process.exit(1);
});
