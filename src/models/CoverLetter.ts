import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICoverLetter extends Document {
  userId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  tone: 'professional' | 'enthusiastic' | 'concise';
  content: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CoverLetterSchema = new Schema<ICoverLetter>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  tone: { type: String, enum: ['professional', 'enthusiastic', 'concise'], required: true },
  content: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Ensure a single cover letter cached per user, job, and tone
CoverLetterSchema.index({ userId: 1, jobId: 1, tone: 1 }, { unique: true });

const CoverLetter: Model<ICoverLetter> = mongoose.models.CoverLetter || mongoose.model<ICoverLetter>('CoverLetter', CoverLetterSchema);
export default CoverLetter;
