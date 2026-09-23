import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { verifyTokenWithRole, getJwtSecret } from '@/middleware/auth';
import { seedHrData } from '@/services/hrSeedService';

export const dynamic = 'force-dynamic';

/**
 * Administrative & Cold-Bootstrap Seed Endpoint for CareerGenie HR & Workforce Intelligence Platform.
 * Supports both GET and POST requests.
 * 
 * Authorization:
 * 1. Admin session cookie or Bearer token (standard RBAC).
 * 2. Secret matching JWT_SECRET via query parameter (?secret=... or ?key=...) or header (x-seed-secret).
 * 3. Cold bootstrap: Allowed if no admin user exists in the database yet (enables initial production provisioning).
 * 
 * Idempotent: safe to run multiple times without creating duplicate records.
 */
async function handleSeed(req: NextRequest) {
  try {
    await dbConnect();

    let isAuthorized = false;

    // 1. Check for active admin user session
    const verification = verifyTokenWithRole(req, ['admin']);
    if (verification) {
      const user = await User.findById(verification.decoded.userId);
      if (user && user.role === 'admin') {
        isAuthorized = true;
      }
    }

    // 2. Check for secret key in query params or header
    if (!isAuthorized) {
      let expectedSecret: string | null = null;
      try {
        expectedSecret = process.env.JWT_SECRET || getJwtSecret();
      } catch {
        expectedSecret = process.env.JWT_SECRET || null;
      }

      if (expectedSecret) {
        const { searchParams } = new URL(req.url);
        const secretParam = searchParams.get('secret') || searchParams.get('key');
        const secretHeader = req.headers.get('x-seed-secret');

        if (secretParam === expectedSecret || secretHeader === expectedSecret) {
          isAuthorized = true;
        }
      }
    }

    // 3. Cold bootstrap check: allow initial seeding if no admin account exists yet
    if (!isAuthorized) {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount === 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: 'Unauthorized. Admin credentials or valid seed secret required.',
          hint: 'Authenticate as admin or pass ?secret=<JWT_SECRET>.'
        },
        { status: 401 }
      );
    }

    // Execute idempotent canonical HR seed
    const summary = await seedHrData();

    return NextResponse.json({
      success: true,
      message: 'HR workforce intelligence dataset seeded successfully.',
      summary
    }, { status: 200 });
  } catch (error: any) {
    console.error('HR Seed Error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Internal server error while seeding HR workforce dataset.'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleSeed(req);
}

export async function POST(req: NextRequest) {
  return handleSeed(req);
}
