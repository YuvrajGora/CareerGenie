import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRiskEvidence {
  signalType: 'performance' | 'engagement' | 'workload' | 'attendance' | 'skill_gap' | 'tenure';
  metric: string;
  observedValue: string;
  benchmark: string;
  significance: 'high' | 'medium' | 'low';
}

export interface IRiskAction {
  actionId: string;
  title: string;
  rationale: string;
  urgency: 'immediate' | 'short_term' | 'strategic';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  assignedTo?: string;
  completedAt?: Date;
}

export interface IWorkforceRisk extends Document {
  employeeId: mongoose.Types.ObjectId;
  riskType: 'attrition' | 'burnout' | 'disengagement' | 'skill_stagnation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  aiExplanation: string;
  evidence: IRiskEvidence[];
  recommendedActions: IRiskAction[];
  status: 'active' | 'mitigated' | 'resolved';
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiskEvidenceSchema = new Schema<IRiskEvidence>({
  signalType: { 
    type: String, 
    enum: ['performance', 'engagement', 'workload', 'attendance', 'skill_gap', 'tenure'], 
    required: true 
  },
  metric: { type: String, required: true },
  observedValue: { type: String, required: true },
  benchmark: { type: String, required: true },
  significance: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' }
}, { _id: false });

const RiskActionSchema = new Schema<IRiskAction>({
  actionId: { type: String, required: true },
  title: { type: String, required: true },
  rationale: { type: String, required: true },
  urgency: { type: String, enum: ['immediate', 'short_term', 'strategic'], default: 'short_term' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'dismissed'], default: 'pending' },
  assignedTo: { type: String },
  completedAt: { type: Date }
}, { _id: false });

const WorkforceRiskSchema = new Schema<IWorkforceRisk>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  riskType: { 
    type: String, 
    required: true, 
    enum: ['attrition', 'burnout', 'disengagement', 'skill_stagnation'], 
    index: true 
  },
  severity: { 
    type: String, 
    required: true, 
    enum: ['low', 'medium', 'high', 'critical'], 
    index: true 
  },
  score: { type: Number, required: true, min: 0, max: 100 },
  aiExplanation: { type: String, required: true },
  evidence: { type: [RiskEvidenceSchema], default: [] },
  recommendedActions: { type: [RiskActionSchema], default: [] },
  status: { 
    type: String, 
    enum: ['active', 'mitigated', 'resolved'], 
    default: 'active', 
    index: true 
  },
  evaluatedAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

WorkforceRiskSchema.index({ employeeId: 1, riskType: 1 });
WorkforceRiskSchema.index({ severity: 1, status: 1 });

const WorkforceRisk: Model<IWorkforceRisk> = mongoose.models.WorkforceRisk || mongoose.model<IWorkforceRisk>('WorkforceRisk', WorkforceRiskSchema);
export default WorkforceRisk;
