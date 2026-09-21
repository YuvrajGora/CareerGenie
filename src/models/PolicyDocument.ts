import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPolicySection {
  sectionId: string;
  title: string;
  content: string;
  keywords: string[];
}

export interface IPolicyDocument extends Document {
  title: string;
  policyCode: string;
  category: 'leave_pto' | 'remote_work' | 'compensation_promotion' | 'code_of_conduct' | 'health_benefits' | 'onboarding';
  summary: string;
  content: string;
  sections: IPolicySection[];
  version: string;
  status: 'active' | 'draft' | 'archived';
  effectiveDate: Date;
  lastReviewedDate?: Date;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PolicySectionSchema = new Schema<IPolicySection>({
  sectionId: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  keywords: { type: [String], default: [] }
}, { _id: false });

const PolicyDocumentSchema = new Schema<IPolicyDocument>({
  title: { type: String, required: true, unique: true, trim: true, index: true },
  policyCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['leave_pto', 'remote_work', 'compensation_promotion', 'code_of_conduct', 'health_benefits', 'onboarding'], 
    index: true 
  },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  sections: { type: [PolicySectionSchema], default: [] },
  version: { type: String, default: '1.0' },
  status: { 
    type: String, 
    enum: ['active', 'draft', 'archived'], 
    default: 'active', 
    index: true 
  },
  effectiveDate: { type: Date, required: true },
  lastReviewedDate: { type: Date },
  approvedBy: { type: String }
}, {
  timestamps: true
});

PolicyDocumentSchema.index({ category: 1, status: 1 });

const PolicyDocument: Model<IPolicyDocument> = mongoose.models.PolicyDocument || mongoose.model<IPolicyDocument>('PolicyDocument', PolicyDocumentSchema);
export default PolicyDocument;
