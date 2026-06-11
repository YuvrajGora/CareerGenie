import { getCurrentUser } from '@/controllers/authController';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req) => {
  return getCurrentUser(req);
});
