const url = 'https://careergenie-wheat.vercel.app';
const email = `test.student.${Date.now()}@example.com`;
const password = 'Password123!';

async function testE2E() {
  console.log('=== CareerGenie Live API E2E Verification ===\n');
  console.log(`Using email: ${email}`);

  // 1. Test Register
  console.log('\n[1/3] Testing Registration API...');
  const regRes = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verification Student',
      email,
      password,
      role: 'student'
    })
  });
  
  const regData = await regRes.json();
  if (regRes.status !== 201) {
    console.error('✗ Registration failed:', regRes.status, regData);
    process.exit(1);
  }
  console.log('✓ Registration successful:', regData.message || 'User registered');

  // 2. Test Login
  console.log('\n[2/3] Testing Login API...');
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginRes.json();
  if (loginRes.status !== 200) {
    console.error('✗ Login failed:', loginRes.status, loginData);
    process.exit(1);
  }
  console.log('✓ Login successful! User token/cookie set.');
  
  // Extract token cookie if present
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log(`- Received Cookie: ${cookieHeader ? cookieHeader.split(';')[0] : 'None'}`);

  // 3. Test Auth Me
  console.log('\n[3/3] Testing Auth Profile API (/api/auth/me)...');
  const meRes = await fetch(`${url}/api/auth/me`, {
    headers: {
      'Cookie': cookieHeader || ''
    }
  });

  const meData = await meRes.json();
  if (meRes.status !== 200) {
    console.error('✗ Auth verification failed:', meRes.status, meData);
    process.exit(1);
  }
  console.log('✓ Auth verification successful! Logged in as:', meData.user);
  console.log('\n=== E2E API VERIFICATION PASSED SUCCESSFULLY ===');
}

testE2E().catch(console.error);
