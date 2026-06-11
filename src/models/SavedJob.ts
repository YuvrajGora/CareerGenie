import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISavedJob extends Document {
  studentId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  savedAt: Date;
}

const SavedJobSchema = new Schema<ISavedJob>({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  savedAt: { type: Date, default: Date.now }
});

// Ensure a student can save a job only once
SavedJobSchema.index({ studentId: 1, jobId: 1 }, { unique: true });

const SavedJob: Model<ISavedJob> = mongoose.models.SavedJob || mongoose.model<ISavedJob>('SavedJob', SavedJobSchema);
export default SavedJob;
