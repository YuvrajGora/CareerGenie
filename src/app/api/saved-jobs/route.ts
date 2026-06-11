import { saveJob, getSavedJobs } from '@/controllers/savedJobController';
import { withAuth } from '@/middleware/auth';

export const POST = withAuth(async (req) => {
  return saveJob(req);
}, ['student']);

export const GET = withAuth(async (req) => {
  return getSavedJobs(req);
}, ['student']);
