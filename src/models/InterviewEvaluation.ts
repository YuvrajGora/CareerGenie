import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompetencyEvaluation {
  competency: string;
  score: number; // 1 to 5
  weight: number; // 0.1 to 1.0
  feedback: string;
  keySignals: string[];
}

export interface IInterviewEvaluation extends Document {
  jobId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewStage: 'screen' | 'technical' | 'system_design' | 'culture_fit' | 'final';
  overallScore: number;
  recommendation: 'strong_hire' | 'hire' | 'borderline' | 'do_not_hire';
  competencies: ICompetencyEvaluation[];
  strengthsSummary: string[];
  concernsSummary: string[];
  rawInterviewNotes?: string;
  aiSynthesis?: string;
  conductedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompetencyEvaluationSchema = new Schema<ICompetencyEvaluation>({
  competency: { type: String, required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  weight: { type: Number, required: true, default: 0.25 },
  feedback: { type: String, required: true },
  keySignals: { type: [String], default: [] }
}, { _id: false });

const InterviewEvaluationSchema = new Schema<IInterviewEvaluation>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateName: { type: String, required: true, trim: true },
  roleTitle: { type: String, required: true, trim: true },
  interviewerName: { type: String, required: true, trim: true },
  interviewStage: { 
    type: String, 
    required: true, 
    enum: ['screen', 'technical', 'system_design', 'culture_fit', 'final'], 
    index: true 
  },
  overallScore: { type: Number, required: true, min: 0, max: 100 },
  recommendation: { 
    type: String, 
    required: true, 
    enum: ['strong_hire', 'hire', 'borderline', 'do_not_hire'], 
    index: true 
  },
  competencies: { type: [CompetencyEvaluationSchema], default: [] },
  strengthsSummary: { type: [String], default: [] },
  concernsSummary: { type: [String], default: [] },
  rawInterviewNotes: { type: String },
  aiSynthesis: { type: String },
  conductedAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

InterviewEvaluationSchema.index({ jobId: 1, candidateId: 1, interviewStage: 1 });

const InterviewEvaluation: Model<IInterviewEvaluation> = 
  mongoose.models.InterviewEvaluation || 
  mongoose.model<IInterviewEvaluation>('InterviewEvaluation', InterviewEvaluationSchema);

export default InterviewEvaluation;
