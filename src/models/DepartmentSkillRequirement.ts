import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDepartmentSkillRequirement extends Document {
  department: 'Engineering' | 'Product & Design' | 'Sales & Marketing' | 'Operations & HR' | 'Finance';
  skillName: string;
  category: 'technical' | 'domain' | 'leadership' | 'soft_skill';
  targetCoverageCount: number;
  minProficiency: 'beginner' | 'intermediate' | 'expert';
  criticality: 'critical' | 'high' | 'medium';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSkillRequirementSchema = new Schema<IDepartmentSkillRequirement>({
  department: {
    type: String,
    required: true,
    enum: ['Engineering', 'Product & Design', 'Sales & Marketing', 'Operations & HR', 'Finance'],
    index: true
  },
  skillName: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['technical', 'domain', 'leadership', 'soft_skill'],
    default: 'technical'
  },
  targetCoverageCount: { type: Number, required: true, min: 1, default: 2 },
  minProficiency: {
    type: String,
    enum: ['beginner', 'intermediate', 'expert'],
    default: 'intermediate'
  },
  criticality: {
    type: String,
    enum: ['critical', 'high', 'medium'],
    default: 'high'
  },
  description: { type: String, trim: true }
}, {
  timestamps: true
});

DepartmentSkillRequirementSchema.index({ department: 1, skillName: 1 }, { unique: true });

const DepartmentSkillRequirement: Model<IDepartmentSkillRequirement> =
  mongoose.models.DepartmentSkillRequirement ||
  mongoose.model<IDepartmentSkillRequirement>('DepartmentSkillRequirement', DepartmentSkillRequirementSchema);

export default DepartmentSkillRequirement;
