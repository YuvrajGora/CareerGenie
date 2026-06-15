import { getOrGeneratePrep } from '@/controllers/interviewPrepController';
import { withAuth } from '@/middleware/auth';
import { withRateLimit } from '@/middleware/rateLimit';

export const POST = withAuth(
  withRateLimit(
    async (req) => {
      return getOrGeneratePrep(req);
    },
    { windowMs: 15 * 60 * 1000, maxHits: 10, keyPrefix: 'interview_prep' }
  ),
  ['student']
);

