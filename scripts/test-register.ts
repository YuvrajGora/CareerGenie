const testRegister = async () => {
  const email = `test_${Date.now()}@example.com`;
  const payload = {
    name: 'Test User',
    email,
    password: 'password123',
    role: 'student'
  };

  console.log('Sending registration payload:', payload);

  try {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    
    console.log('Response status:', status);
    console.log('Response content-type:', contentType);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log('Response JSON:', data);
    } else {
      const text = await response.text();
      console.log('Response Text (non-JSON):', text.substring(0, 1000));
    }
  } catch (error) {
    console.error('Fetch request failed:', error);
  }
};

testRegister();
