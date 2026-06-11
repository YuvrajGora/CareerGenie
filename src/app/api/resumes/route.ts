import { uploadResume, getResume } from '@/controllers/resumeController';
import { withAuth } from '@/middleware/auth';

export const POST = withAuth(async (req) => {
  return uploadResume(req);
}, ['student']);

export const GET = withAuth(async (req) => {
  return getResume(req);
}, ['student']);
