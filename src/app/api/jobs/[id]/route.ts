import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { getJobById, updateJob, deleteJob } from '@/controllers/jobController';
import { withAuth } from '@/middleware/auth';

export async function GET(req: NextRequest, context: any) {
  await dbConnect();
  const params = await context.params;
  return getJobById(req, { params });
}

export const PUT = withAuth(async (req, context) => {
  const params = await context.params;
  return updateJob(req, { params });
}, ['recruiter', 'admin']);

export const DELETE = withAuth(async (req, context) => {
  const params = await context.params;
  return deleteJob(req, { params });
}, ['recruiter', 'admin']);
