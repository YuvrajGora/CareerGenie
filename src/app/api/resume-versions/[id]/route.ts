import { withAuth } from '@/middleware/auth';
import {
  getResumeVersionById,
  updateResumeVersion,
  deleteResumeVersion
} from '@/controllers/resumeVersionController';

export const GET = withAuth(async (req, context) => {
  const params = await context.params;
  return getResumeVersionById(req, { params });
}, ['student']);

export const PUT = withAuth(async (req, context) => {
  const params = await context.params;
  return updateResumeVersion(req, { params });
}, ['student']);

export const DELETE = withAuth(async (req, context) => {
  const params = await context.params;
  return deleteResumeVersion(req, { params });
}, ['student']);
