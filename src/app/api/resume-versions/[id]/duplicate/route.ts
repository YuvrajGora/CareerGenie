import { withAuth } from '@/middleware/auth';
import { duplicateResumeVersion } from '@/controllers/resumeVersionController';

export const POST = withAuth(async (req, context) => {
  const params = await context.params;
  return duplicateResumeVersion(req, { params });
}, ['student']);
