import { withAuth } from '@/middleware/auth';
import { recalculateResumeScore } from '@/controllers/resumeVersionController';

export const POST = withAuth(async (req, context) => {
  const params = await context.params;
  return recalculateResumeScore(req, { params });
}, ['student']);
