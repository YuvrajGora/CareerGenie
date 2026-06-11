import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IApplication extends Document {
  studentId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  matchScore: number;
  status: 'applied' | 'interviewing' | 'accepted' | 'rejected';
  appliedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  matchScore: { type: Number, required: true, min: 0, max: 100 },
  status: { type: String, enum: ['applied', 'interviewing', 'accepted', 'rejected'], default: 'applied' },
  appliedAt: { type: Date, default: Date.now }
});

// Avoid multiple applications from the same student to the same job
ApplicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true });

const Application: Model<IApplication> = mongoose.models.Application || mongoose.model<IApplication>('Application', ApplicationSchema);
export default Application;
