import { deleteOwnAccount } from '@/controllers/userController';
import { withAuth } from '@/middleware/auth';

export const DELETE = withAuth(async (req) => {
  return deleteOwnAccount(req);
});
