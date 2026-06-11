import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  fileUrl: string;
  extractedText: string;
  version: number;
  uploadedAt: Date;
}

const ResumeSchema = new Schema<IResume>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileUrl: { type: String, required: true },
  extractedText: { type: String, required: true },
  version: { type: Number, default: 1 },
  uploadedAt: { type: Date, default: Date.now }
});

const Resume: Model<IResume> = mongoose.models.Resume || mongoose.model<IResume>('Resume', ResumeSchema);
export default Resume;
