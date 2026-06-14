import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { protect } from '../middlewares/auth';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  addPhoneSchema,
  emergencyContactsSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validators/auth.validator';
import { z } from 'zod';

const router = Router();

const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  type: z.enum(['email_verification', 'phone_verification', 'reset_password']),
});

const verifyPhoneSchema = z.object({
  otp: z.string().length(4, 'OTP must be 4 digits'),
});

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/verify-email', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.get('/me', protect, authController.getMe);
router.post('/add-phone', protect, validate(addPhoneSchema), authController.addPhone);
router.post('/verify-phone', protect, validate(verifyPhoneSchema), authController.verifyPhone);
router.post('/emergency-contacts', protect, validate(emergencyContactsSchema), authController.emergencyContacts);

export default router;
