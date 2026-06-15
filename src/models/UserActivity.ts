import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserActivity extends Document {
  userId: mongoose.Types.ObjectId;
  activityType: 'Resume Uploaded' | 'Resume Analyzed' | 'Job Applied' | 'Application Accepted' | 'Application Rejected' | 'Profile Updated';
  details?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const UserActivitySchema = new Schema<IUserActivity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activityType: { 
    type: String, 
    required: true, 
    enum: [
      'Resume Uploaded', 
      'Resume Analyzed', 
      'Job Applied', 
      'Application Accepted', 
      'Application Rejected', 
      'Profile Updated'
    ] 
  },
  details: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

const UserActivity: Model<IUserActivity> = mongoose.models.UserActivity || mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);
export default UserActivity;
