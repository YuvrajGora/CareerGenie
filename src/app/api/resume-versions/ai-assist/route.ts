import { withAuth } from '@/middleware/auth';
import { withRateLimit } from '@/middleware/rateLimit';
import { handleAiAssist } from '@/controllers/resumeVersionController';

export const POST = withAuth(
  withRateLimit(
    async (req) => {
      return handleAiAssist(req);
    },
    { windowMs: 15 * 60 * 1000, maxHits: 30, keyPrefix: 'resume_ai_assist' }
  ),
  ['student']
);
