import jwt from 'jsonwebtoken';

const testMe = async () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'cg_dev_secret_jwt_token_98234751923487056';
  
  const token = jwt.sign(
    { userId: '6a2802c235e5a095ca86dc18', role: 'student' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  console.log('Testing /api/auth/me with signed token:', token);

  try {
    const response = await fetch('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${token}`
      }
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

testMe();
