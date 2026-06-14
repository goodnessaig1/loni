import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  status: z.enum(['pregnant', 'newMom']),
  trimester: z.string().optional(),
  pregnancyWeek: z.string().optional(),
  babyAge: z.string().optional(),
  referredBy: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  type: z.enum(['email_verification', 'phone_verification', 'reset_password']),
});

export const addPhoneSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
});

export const emergencyContactsSchema = z.object({
  contacts: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().min(1, 'Phone is required'),
    relationship: z.string().min(1, 'Relationship is required'),
  })),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
