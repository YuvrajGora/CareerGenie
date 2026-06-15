import { getOrGenerateCoverLetter } from '@/controllers/coverLetterController';
import { withAuth } from '@/middleware/auth';
import { withRateLimit } from '@/middleware/rateLimit';

export const POST = withAuth(
  withRateLimit(
    async (req) => {
      return getOrGenerateCoverLetter(req);
    },
    { windowMs: 15 * 60 * 1000, maxHits: 10, keyPrefix: 'cover_letter' }
  ),
  ['student']
);

