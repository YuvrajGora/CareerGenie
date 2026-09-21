import { changePassword } from '@/controllers/userController';
import { withAuth } from '@/middleware/auth';

export const PUT = withAuth(async (req) => {
  return changePassword(req);
});
