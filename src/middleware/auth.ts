import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User, { IUser } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export interface AuthenticatedRequest extends NextRequest {
  user?: IUser;
}

export interface AuthDecoded {
  userId: string;
  role: string;
}

/**
 * Helper to sign JWT tokens
 */
export function signToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
}

/**
 * Verifies JWT token from request cookies or Authorization header.
 * Returns the decoded payload or null if invalid.
 */
export function verifyToken(req: NextRequest): AuthDecoded | null {
  try {
    let token = '';

    // Check cookies
    const cookieToken = req.cookies.get('token')?.value;
    if (cookieToken) {
      token = cookieToken;
    } else {
      // Check Authorization header
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as AuthDecoded;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Authentication wrapper for Next.js Route Handlers.
 * Wraps a handler and injects the verified user.
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, context: any) => Promise<NextResponse>,
  allowedRoles?: ('student' | 'recruiter' | 'admin')[]
) {
  return async (req: NextRequest, context: any) => {
    try {
      await dbConnect();
      const decoded = verifyToken(req);

      if (!decoded) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
      }

      // Fetch user from DB
      const user = await User.findById(decoded.userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 401 });
      }

      // Check RBAC permissions
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: `Forbidden. Access restricted to roles: ${allowedRoles.join(', ')}.` },
          { status: 403 }
        );
      }

      // Cast request to AuthenticatedRequest and append user
      const authReq = req as AuthenticatedRequest;
      authReq.user = user;

      return await handler(authReq, context);
    } catch (err: any) {
      console.error('Auth middleware error:', err);
      return NextResponse.json({ error: 'Internal server authentication error' }, { status: 500 });
    }
  };
}
