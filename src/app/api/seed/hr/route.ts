import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { seedHrData } from '@/services/hrSeedService';

/**
 * Administrative Seed Endpoint for CareerGenie HR & Workforce Intelligence Platform.
 * Strictly restricted to users with the 'admin' role via withAuth middleware.
 * Idempotent: safe to run multiple times without creating duplicate records.
 */
export const POST = withAuth(async () => {
  try {
    const summary = await seedHrData();
    return NextResponse.json({
      message: 'HR workforce intelligence dataset seeded successfully.',
      summary
    }, { status: 200 });
  } catch (error: any) {
    console.error('HR Seed Error:', error);
    return NextResponse.json({
      error: 'Internal server error while seeding HR workforce dataset.'
    }, { status: 500 });
  }
}, ['admin']);
