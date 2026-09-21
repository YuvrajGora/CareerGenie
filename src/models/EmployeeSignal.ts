import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployeeSignal extends Document {
  employeeId: mongoose.Types.ObjectId;
  type: 'performance' | 'engagement' | 'workload' | 'attendance';
  metric: string;
  value: number;
  unit?: string;
  period: string;
  benchmark?: number;
  deviationPct?: number;
  recordedAt: Date;
  notes?: string;
}

const EmployeeSignalSchema = new Schema<IEmployeeSignal>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['performance', 'engagement', 'workload', 'attendance'], 
    index: true 
  },
  metric: { type: String, required: true, trim: true },
  value: { type: Number, required: true },
  unit: { type: String, trim: true, default: '' },
  period: { type: String, required: true, trim: true, index: true },
  benchmark: { type: Number },
  deviationPct: { type: Number },
  recordedAt: { type: Date, default: Date.now, index: true },
  notes: { type: String, trim: true }
});

EmployeeSignalSchema.index({ employeeId: 1, type: 1, period: 1 });
EmployeeSignalSchema.index({ type: 1, metric: 1 });

const EmployeeSignal: Model<IEmployeeSignal> = mongoose.models.EmployeeSignal || mongoose.model<IEmployeeSignal>('EmployeeSignal', EmployeeSignalSchema);
export default EmployeeSignal;
