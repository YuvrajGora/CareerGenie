import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { createJob, getJobs } from '@/controllers/jobController';
import { withAuth } from '@/middleware/auth';

export const POST = withAuth(async (req) => {
  return createJob(req);
}, ['recruiter', 'admin']);

export async function GET(req: NextRequest) {
  await dbConnect();
  return getJobs(req);
}
