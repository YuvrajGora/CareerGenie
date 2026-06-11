import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJob extends Document {
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  experience: number; // in years
  salaryMin: number;
  salaryMax: number;
  location: string;
  recruiterId: mongoose.Types.ObjectId;
  status: 'active' | 'closed';
  createdAt: Date;
}

const JobSchema = new Schema<IJob>({
  title: { type: String, required: true },
  company: { type: String, required: true },
  description: { type: String, required: true },
  requiredSkills: { type: [String], default: [] },
  experience: { type: Number, required: true, default: 0 },
  salaryMin: { type: Number, required: true, default: 0 },
  salaryMax: { type: Number, required: true, default: 0 },
  location: { type: String, required: true },
  recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const Job: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
export default Job;
