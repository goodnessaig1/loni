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
  gender: z.enum(['Male', 'Female', 'Others']).optional(),
  userType: z.enum(['nurse', 'user', 'rider', 'admin']).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['pregnant', 'newMom']).optional(),
  trimester: z.string().optional(),
  pregnancyWeek: z.string().optional(),
  babyAge: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Others']).optional(),
  userType: z.enum(['nurse', 'user', 'rider', 'admin']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(4, 'OTP must be 4 digits'),
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
  otp: z.string().length(4, 'OTP must be 4 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
