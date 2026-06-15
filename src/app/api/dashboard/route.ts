import { getDashboardData } from '@/controllers/dashboardController';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req) => {
  return getDashboardData(req);
}, ['student']);
