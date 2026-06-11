import { unsaveJob } from '@/controllers/savedJobController';
import { withAuth } from '@/middleware/auth';

export const DELETE = withAuth(async (req, context) => {
  const params = await context.params;
  return unsaveJob(req, { params });
}, ['student']);
