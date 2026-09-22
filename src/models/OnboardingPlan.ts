import mongoose, { Schema, Document, Model } from 'mongoose';

export type MilestoneCategory = 'compliance' | 'technical_setup' | 'team_integration' | 'role_training';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type OnboardingPlanStatus = 'on_track' | 'delayed' | 'completed';
export type AdaptationTrigger = 'manual' | 'ai_velocity_check' | 'delay_escalation';

export interface IOnboardingMilestone {
  milestoneId: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  dueDay: number;
  completed: boolean;
  completedAt?: Date;
  verifiedBy?: string;
  notes?: string;
  targetDate?: Date;
  resourceLink?: string;
  status?: MilestoneStatus;
}

export interface IAdaptationRecord {
  adaptedAt: Date;
  trigger: AdaptationTrigger;
  reason: string;
  suggestedAdjustments: string[];
  appliedBy?: string;
}

export interface IOnboardingCheckpoint {
  day: 30 | 60 | 90;
  completed: boolean;
  completedAt?: Date;
  rating?: number;
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
  status: OnboardingPlanStatus;
  milestones: IOnboardingMilestone[];
  aiGuidanceNotes?: string;
  velocityScore?: number;
  adaptationHistory?: IAdaptationRecord[];
  checkpoints?: IOnboardingCheckpoint[];
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
  notes: { type: String },
  targetDate: { type: Date },
  resourceLink: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'overdue'], 
    default: 'pending' 
  }
}, { _id: false });

const AdaptationRecordSchema = new Schema<IAdaptationRecord>({
  adaptedAt: { type: Date, default: Date.now },
  trigger: { 
    type: String, 
    enum: ['manual', 'ai_velocity_check', 'delay_escalation'], 
    default: 'manual' 
  },
  reason: { type: String, required: true },
  suggestedAdjustments: { type: [String], default: [] },
  appliedBy: { type: String }
}, { _id: false });

const OnboardingCheckpointSchema = new Schema<IOnboardingCheckpoint>({
  day: { type: Number, enum: [30, 60, 90], required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  rating: { type: Number, min: 1, max: 5 },
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
  aiGuidanceNotes: { type: String },
  velocityScore: { type: Number, min: 0, max: 100, default: 100 },
  adaptationHistory: { type: [AdaptationRecordSchema], default: [] },
  checkpoints: { type: [OnboardingCheckpointSchema], default: [] }
}, {
  timestamps: true
});

const OnboardingPlan: Model<IOnboardingPlan> = mongoose.models.OnboardingPlan || mongoose.model<IOnboardingPlan>('OnboardingPlan', OnboardingPlanSchema);
export default OnboardingPlan;
