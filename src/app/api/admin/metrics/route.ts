import { getSystemMetrics } from '@/controllers/adminController';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req) => {
  return getSystemMetrics(req);
}, ['admin']);
