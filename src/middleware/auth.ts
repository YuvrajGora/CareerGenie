import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User, { IUser } from '@/models/User';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production configuration.');
    }
    return 'cg_development_only_secret_jwt_key_do_not_use_in_prod';
  }
  return secret;
}

export type UserRole = 'student' | 'recruiter' | 'admin';

export const ROLE_COOKIE_MAP: Record<UserRole, string> = {
  student: 'cg_student_token',
  recruiter: 'cg_recruiter_token',
  admin: 'cg_admin_token',
};

export const ROLE_HEADER_NAME = 'x-careergenie-role';

export interface AuthenticatedRequest extends NextRequest {
  user?: IUser;
}

export interface AuthDecoded {
  userId: string;
  role: string;
}

export interface VerifyTokenResult {
  decoded: AuthDecoded;
  requestedRole?: UserRole;
}

/**
 * Helper to sign JWT tokens
 */
export function signToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
}

/**
 * Deterministically verifies JWT token according to active role context.
 * Resolution order:
 * 1. If X-CareerGenie-Role header is provided:
 *    - Validate it against known roles.
 *    - Select ONLY that role's cookie.
 * 2. Else if no role header is provided AND allowedRoles has exactly one role:
 *    - Select ONLY that role's cookie.
 * 3. Otherwise:
 *    - Do NOT iterate through cookies.
 *    - Check Authorization header (Bearer token) or return null.
 */
export function verifyTokenWithRole(
  req: NextRequest,
  allowedRoles?: UserRole[]
): VerifyTokenResult | null {
  try {
    let token = '';
    let requestedRole: UserRole | undefined = undefined;

    const rawHeaderRole = req.headers.get(ROLE_HEADER_NAME)?.toLowerCase()?.trim();

    if (rawHeaderRole) {
      if (rawHeaderRole === 'student' || rawHeaderRole === 'recruiter' || rawHeaderRole === 'admin') {
        requestedRole = rawHeaderRole;
        const cookieName = ROLE_COOKIE_MAP[requestedRole];
        token = req.cookies.get(cookieName)?.value || '';
      } else {
        // Unknown role header provided -> reject deterministically
        return null;
      }
    } else if (allowedRoles && allowedRoles.length === 1) {
      const singleRole = allowedRoles[0];
      const cookieName = ROLE_COOKIE_MAP[singleRole];
      token = req.cookies.get(cookieName)?.value || '';
    }

    // If no cookie was selected via role header or single allowed role,
    // check Authorization header fallback
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    const decoded = jwt.verify(token, getJwtSecret()) as AuthDecoded;
    return { decoded, requestedRole };
  } catch (error) {
    return null;
  }
}

/**
 * Backwards-compatible verifyToken helper
 */
export function verifyToken(req: NextRequest, allowedRoles?: UserRole[]): AuthDecoded | null {
  const result = verifyTokenWithRole(req, allowedRoles);
  return result ? result.decoded : null;
}

/**
 * Authentication wrapper for Next.js Route Handlers.
 * Wraps a handler and injects the verified user.
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, context: any) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
) {
  return async (req: NextRequest, context: any) => {
    try {
      await dbConnect();
      const verification = verifyTokenWithRole(req, allowedRoles);

      if (!verification) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
      }

      const { decoded, requestedRole } = verification;

      // Fetch user from DB
      const user = await User.findById(decoded.userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 401 });
      }

      // If active role header was specified, verify that the authenticated user's actual role matches it
      if (requestedRole && user.role !== requestedRole) {
        return NextResponse.json(
          { error: `Forbidden. Role mismatch: active session is '${user.role}' but '${requestedRole}' was requested.` },
          { status: 403 }
        );
      }

      // Verify token payload role matches database user role
      if (decoded.role !== user.role) {
        return NextResponse.json(
          { error: 'Forbidden. Stale or invalid session credentials.' },
          { status: 403 }
        );
      }

      // Check RBAC permissions
      if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
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
