import { deleteUser } from '@/controllers/adminController';
import { withAuth } from '@/middleware/auth';

export const DELETE = withAuth(async (req, context) => {
  const params = await context.params;
  return deleteUser(req, { params });
}, ['admin']);
