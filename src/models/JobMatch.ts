import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJobMatch extends Document {
  studentId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  matchScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  calculatedAt: Date;
}

const JobMatchSchema = new Schema<IJobMatch>({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  matchScore: { type: Number, required: true, min: 0, max: 100 },
  skillsMatch: { type: Number, required: true, min: 0, max: 100 },
  experienceMatch: { type: Number, required: true, min: 0, max: 100 },
  educationMatch: { type: Number, required: true, min: 0, max: 100 },
  calculatedAt: { type: Date, default: Date.now }
});

JobMatchSchema.index({ studentId: 1, jobId: 1 }, { unique: true });

const JobMatch: Model<IJobMatch> = mongoose.models.JobMatch || mongoose.model<IJobMatch>('JobMatch', JobMatchSchema);
export default JobMatch;
