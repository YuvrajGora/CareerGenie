import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInterviewQuestion {
  question: string;
  suggestedAnswer: string;
  recruiterIntent: string;
  type: 'technical' | 'behavioral';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface IInterviewWeakness {
  skill: string;
  reason: string;
  recommendation: string;
}

export interface IInterviewPrep extends Document {
  userId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  questions: IInterviewQuestion[];
  weaknesses: IInterviewWeakness[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewQuestionSchema = new Schema<IInterviewQuestion>({
  question: { type: String, required: true },
  suggestedAnswer: { type: String, required: true },
  recruiterIntent: { type: String, required: true },
  type: { type: String, enum: ['technical', 'behavioral'], required: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true }
}, { _id: false });

const InterviewWeaknessSchema = new Schema<IInterviewWeakness>({
  skill: { type: String, required: true },
  reason: { type: String, required: true },
  recommendation: { type: String, required: true }
}, { _id: false });

const InterviewPrepSchema = new Schema<IInterviewPrep>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  questions: { type: [InterviewQuestionSchema], default: [] },
  weaknesses: { type: [InterviewWeaknessSchema], default: [] },
  generatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Compound index to guarantee one cached prep per user per job
InterviewPrepSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const InterviewPrep: Model<IInterviewPrep> = mongoose.models.InterviewPrep || mongoose.model<IInterviewPrep>('InterviewPrep', InterviewPrepSchema);
export default InterviewPrep;
