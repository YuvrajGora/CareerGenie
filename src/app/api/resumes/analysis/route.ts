import { getResumeAnalysis } from '@/controllers/resumeController';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req) => {
  return getResumeAnalysis(req);
}, ['student']);
