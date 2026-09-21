import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOnboardingMilestone {
  milestoneId: string;
  title: string;
  description: string;
  category: 'compliance' | 'technical_setup' | 'team_integration' | 'role_training';
  dueDay: number;
  completed: boolean;
  completedAt?: Date;
  verifiedBy?: string;
  notes?: string;
}

export interface IOnboardingPlan extends Document {
  employeeId: mongoose.Types.ObjectId;
  roleTitle: string;
  department: string;
  mentorName?: string;
  startDate: Date;
  targetCompletionDate: Date;
  overallProgress: number;
  status: 'on_track' | 'delayed' | 'completed';
  milestones: IOnboardingMilestone[];
  aiGuidanceNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingMilestoneSchema = new Schema<IOnboardingMilestone>({
  milestoneId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['compliance', 'technical_setup', 'team_integration', 'role_training'], 
    required: true 
  },
  dueDay: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  verifiedBy: { type: String },
  notes: { type: String }
}, { _id: false });

const OnboardingPlanSchema = new Schema<IOnboardingPlan>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true, index: true },
  roleTitle: { type: String, required: true },
  department: { type: String, required: true, index: true },
  mentorName: { type: String },
  startDate: { type: Date, required: true },
  targetCompletionDate: { type: Date, required: true },
  overallProgress: { type: Number, min: 0, max: 100, default: 0 },
  status: { 
    type: String, 
    enum: ['on_track', 'delayed', 'completed'], 
    default: 'on_track', 
    index: true 
  },
  milestones: { type: [OnboardingMilestoneSchema], default: [] },
  aiGuidanceNotes: { type: String }
}, {
  timestamps: true
});

const OnboardingPlan: Model<IOnboardingPlan> = mongoose.models.OnboardingPlan || mongoose.model<IOnboardingPlan>('OnboardingPlan', OnboardingPlanSchema);
export default OnboardingPlan;
