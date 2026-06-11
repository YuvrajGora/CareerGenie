import { getNotifications, markRead } from '@/controllers/notificationController';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req) => {
  return getNotifications(req);
});

export const PUT = withAuth(async (req) => {
  return markRead(req);
});
