import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDashboardRecommendation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  text: string;
  skills: string[];
  generatedAt: Date;
}

const DashboardRecommendationSchema = new Schema<IDashboardRecommendation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  title: { type: String, required: true },
  text: { type: String, required: true },
  skills: { type: [String], default: [] },
  generatedAt: { type: Date, default: Date.now }
});

const DashboardRecommendation: Model<IDashboardRecommendation> = 
  mongoose.models.DashboardRecommendation || mongoose.model<IDashboardRecommendation>('DashboardRecommendation', DashboardRecommendationSchema);
export default DashboardRecommendation;
