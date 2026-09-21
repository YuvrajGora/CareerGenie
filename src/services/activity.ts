import UserActivity from '@/models/UserActivity';
import dbConnect from '@/lib/db';

export async function recordActivity(
  userId: any, 
  activityType: 'Resume Uploaded' | 'Resume Analyzed' | 'Job Applied' | 'Application Accepted' | 'Application Rejected' | 'Profile Updated' | 'Password Changed', 
  details?: string, 
  metadata?: Record<string, any>
) {
  try {
    await dbConnect();
    await UserActivity.create({
      userId,
      activityType,
      details,
      metadata,
      createdAt: new Date()
    });
    console.info(`Logged activity: "${activityType}" for user: ${userId}`);
  } catch (err) {
    console.error('Error logging user activity:', err);
  }
}
