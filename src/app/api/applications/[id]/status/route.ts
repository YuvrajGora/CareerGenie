import { updateApplicationStatus } from '@/controllers/applicationController';
import { withAuth } from '@/middleware/auth';

export const PUT = withAuth(async (req, context) => {
  const params = await context.params;
  return updateApplicationStatus(req, { params });
}, ['recruiter', 'admin']);
