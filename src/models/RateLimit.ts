import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRateLimit extends Document {
  key: string;
  points: number;
  expireAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true, index: true },
  points: { type: Number, required: true, default: 1 },
  expireAt: { type: Date, required: true }
});

// TTL index to automatically remove expired rate limit records
RateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> = mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);
export default RateLimit;
