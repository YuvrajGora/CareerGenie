import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'recruiter', 'admin']).default('student'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  skills: z.array(z.string()).optional(),
  education: z.string().optional(),
  profileImage: z.string().url('Invalid image URL').or(z.literal('')).optional(),
});

export const createJobSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  company: z.string().min(1, 'Company name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  requiredSkills: z.array(z.string()).min(1, 'At least one required skill is required'),
  experience: z.number().nonnegative('Experience must be a positive number'),
  salaryMin: z.number().nonnegative('Minimum salary must be a positive number'),
  salaryMax: z.number().nonnegative('Maximum salary must be a positive number'),
  location: z.string().min(1, 'Location is required'),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['applied', 'interviewing', 'accepted', 'rejected']),
});
