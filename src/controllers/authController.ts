import { NextRequest, NextResponse } from 'next/server';
import User from '@/models/User';
import { signToken } from '@/middleware/auth';
import { registerSchema, loginSchema } from '@/validations/validation';

export async function register(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { name, email, password, role } = validation.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 400 });
    }

    // Create user (password hashed in pre-save hook)
    const user = new User({ name, email, password, role });
    await user.save();

    // Sign JWT
    const token = signToken({ userId: user._id.toString(), role: user.role });

    // Remove password before returning
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      skills: user.skills,
      education: user.education,
      yearsOfExperience: user.yearsOfExperience,
      careerLevel: user.careerLevel,
    };

    const response = NextResponse.json({
      message: 'Registration successful.',
      token,
      user: userResponse
    }, { status: 201 });

    // Set cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error during registration.' }, { status: 500 });
  }
}

export async function login(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Find user (explicitly select password since select: false in schema)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Sign JWT
    const token = signToken({ userId: user._id.toString(), role: user.role });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      skills: user.skills,
      education: user.education,
      yearsOfExperience: user.yearsOfExperience,
      careerLevel: user.careerLevel,
    };

    const response = NextResponse.json({
      message: 'Login successful.',
      token,
      user: userResponse
    });

    // Set cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during login.' }, { status: 500 });
  }
}

export async function getCurrentUser(req: any) {
  // req.user is populated by withAuth middleware
  const user = req.user;
  return NextResponse.json({ user });
}
