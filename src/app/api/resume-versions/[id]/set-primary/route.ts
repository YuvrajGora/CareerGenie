import { withAuth } from '@/middleware/auth';
import { setPrimaryResumeVersion } from '@/controllers/resumeVersionController';

export const POST = withAuth(async (req, context) => {
  const params = await context.params;
  return setPrimaryResumeVersion(req, { params });
}, ['student']);
