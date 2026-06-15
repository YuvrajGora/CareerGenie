import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'student' | 'recruiter' | 'admin';
  profileImage?: string;
  skills: string[];
  education?: string;
  yearsOfExperience?: number;
  careerLevel?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'recruiter', 'admin'], default: 'student' },
  profileImage: { type: String, default: '' },
  skills: { type: [String], default: [] },
  education: { type: String, default: '' },
  yearsOfExperience: { type: Number, default: 0 },
  careerLevel: { type: String, default: 'Intern' }
}, {
  timestamps: true
});

UserSchema.pre('save', async function(this: any) {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const password = this.password;
  if (!password) {
    throw new Error('Password field was not selected during query.');
  }
  return bcrypt.compare(candidatePassword, password);
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
