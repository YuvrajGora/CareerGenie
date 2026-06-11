import { applyToJob, getApplications } from '@/controllers/applicationController';
import { withAuth } from '@/middleware/auth';

export const POST = withAuth(async (req) => {
  return applyToJob(req);
}, ['student']);

export const GET = withAuth(async (req) => {
  return getApplications(req);
}, ['student', 'recruiter', 'admin']);
