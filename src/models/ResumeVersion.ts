import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IResumeVersion extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  targetRole?: string;
  template: 'modern' | 'professional' | 'minimal';
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    website?: string;
    linkedin?: string;
    github?: string;
  };
  summary: string;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa?: string;
  }>;
  experience: Array<{
    company: string;
    position: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string[];
  }>;
  projects: Array<{
    title: string;
    role: string;
    technologies: string[];
    link?: string;
    description: string[];
  }>;
  skills: string[];
  certifications: string[];
  isPrimary: boolean;
  lastScore: number;
  analysisHistory: Array<{
    score: number;
    strengths: string[];
    weaknesses: string[];
    analyzedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeVersionSchema = new Schema<IResumeVersion>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  targetRole: { type: String },
  template: { type: String, enum: ['modern', 'professional', 'minimal'], default: 'modern' },
  personalInfo: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' }
  },
  summary: { type: String, default: '' },
  education: [{
    institution: { type: String, default: '' },
    degree: { type: String, default: '' },
    fieldOfStudy: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    gpa: { type: String, default: '' }
  }],
  experience: [{
    company: { type: String, default: '' },
    position: { type: String, default: '' },
    location: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    current: { type: Boolean, default: false },
    description: [{ type: String }]
  }],
  projects: [{
    title: { type: String, default: '' },
    role: { type: String, default: '' },
    technologies: [{ type: String }],
    link: { type: String, default: '' },
    description: [{ type: String }]
  }],
  skills: [{ type: String }],
  certifications: [{ type: String }],
  isPrimary: { type: Boolean, default: false, index: true },
  lastScore: { type: Number, default: 0 },
  analysisHistory: [{
    score: { type: Number, required: true },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    analyzedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

const ResumeVersion: Model<IResumeVersion> = mongoose.models.ResumeVersion || mongoose.model<IResumeVersion>('ResumeVersion', ResumeVersionSchema);
export default ResumeVersion;
