import { withAuth } from '@/middleware/auth';
import { getResumeVersions, createResumeVersion } from '@/controllers/resumeVersionController';

export const GET = withAuth(async (req) => {
  return getResumeVersions(req);
}, ['student']);

export const POST = withAuth(async (req) => {
  return createResumeVersion(req);
}, ['student']);
