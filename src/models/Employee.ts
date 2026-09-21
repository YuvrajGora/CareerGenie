import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployeeSkill {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'expert';
  category: 'technical' | 'domain' | 'leadership' | 'soft_skill';
  verified: boolean;
  lastAssessed?: Date;
}

export interface IEmployee extends Document {
  userId?: mongoose.Types.ObjectId;
  employeeCode: string;
  name: string;
  email: string;
  department: 'Engineering' | 'Product & Design' | 'Sales & Marketing' | 'Operations & HR' | 'Finance';
  roleTitle: string;
  level: 'Junior' | 'Mid-Level' | 'Senior' | 'Lead' | 'Staff' | 'Director';
  managerId?: mongoose.Types.ObjectId;
  managerName?: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract';
  joiningDate: Date;
  salary: number;
  status: 'active' | 'onboarding' | 'probation' | 'notice_period' | 'terminated';
  skills: IEmployeeSkill[];
  performanceRating: number;
  flightRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSkillSchema = new Schema<IEmployeeSkill>({
  name: { type: String, required: true, trim: true },
  proficiency: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'expert'], 
    required: true, 
    default: 'intermediate' 
  },
  category: { 
    type: String, 
    enum: ['technical', 'domain', 'leadership', 'soft_skill'], 
    default: 'technical' 
  },
  verified: { type: Boolean, default: false },
  lastAssessed: { type: Date }
}, { _id: false });

const EmployeeSchema = new Schema<IEmployee>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  employeeCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  department: { 
    type: String, 
    required: true, 
    enum: ['Engineering', 'Product & Design', 'Sales & Marketing', 'Operations & HR', 'Finance'],
    index: true 
  },
  roleTitle: { type: String, required: true, trim: true },
  level: { 
    type: String, 
    required: true, 
    enum: ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Staff', 'Director'], 
    default: 'Junior' 
  },
  managerId: { type: Schema.Types.ObjectId, ref: 'Employee' },
  managerName: { type: String, trim: true },
  location: { type: String, required: true, default: 'Remote' },
  employmentType: { 
    type: String, 
    enum: ['full_time', 'part_time', 'contract'], 
    default: 'full_time' 
  },
  joiningDate: { type: Date, required: true },
  salary: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['active', 'onboarding', 'probation', 'notice_period', 'terminated'], 
    default: 'active',
    index: true 
  },
  skills: { type: [EmployeeSkillSchema], default: [] },
  performanceRating: { type: Number, min: 1.0, max: 5.0, default: 3.0 },
  flightRiskLevel: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'low',
    index: true 
  }
}, {
  timestamps: true
});

EmployeeSchema.index({ department: 1, status: 1 });
EmployeeSchema.index({ department: 1, level: 1 });

const Employee: Model<IEmployee> = mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);
export default Employee;
