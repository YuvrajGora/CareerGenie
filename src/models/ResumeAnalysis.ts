import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IResumeAnalysis extends Document {
  resumeId: mongoose.Types.ObjectId;
  overallScore: number;
  atsScore: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  suggestions: string[];
  analyzedAt: Date;
}

const ResumeAnalysisSchema = new Schema<IResumeAnalysis>({
  resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
  overallScore: { type: Number, required: true, min: 0, max: 100 },
  atsScore: { type: Number, required: true, min: 0, max: 100 },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  missingSkills: { type: [String], default: [] },
  suggestions: { type: [String], default: [] },
  analyzedAt: { type: Date, default: Date.now }
});

const ResumeAnalysis: Model<IResumeAnalysis> = mongoose.models.ResumeAnalysis || mongoose.model<IResumeAnalysis>('ResumeAnalysis', ResumeAnalysisSchema);
export default ResumeAnalysis;
