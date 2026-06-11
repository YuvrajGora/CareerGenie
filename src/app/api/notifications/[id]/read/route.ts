import { markRead } from '@/controllers/notificationController';
import { withAuth } from '@/middleware/auth';

export const PUT = withAuth(async (req, context) => {
  const params = await context.params;
  return markRead(req, { params });
});
