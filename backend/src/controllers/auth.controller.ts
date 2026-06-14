import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middlewares/auth';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (error.message === 'User with this email already exists') {
        res.status(400);
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error.message === 'Invalid email or password') {
        res.status(401);
      }
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, type } = req.body;
      const result = await authService.verifyOtp(email, otp, type);
      res.status(200).json({ success: true, message: 'Verification successful', data: result });
    } catch (error: any) {
      res.status(400);
      next(error);
    }
  }

  async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, type } = req.body;
      await authService.resendOtp(email, type);
      res.status(200).json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
      next(error);
    }
  }

  async addPhone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.body;
      await authService.addPhone(req.user.id, phone, req.user.email);
      res.status(200).json({ success: true, message: 'Phone added, OTP sent to email' });
    } catch (error) {
      next(error);
    }
  }

  async verifyPhone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { otp } = req.body;
      // using user's email since OTP is tied to email and sent to email
      await authService.verifyOtp(req.user.email, otp, 'phone_verification');
      res.status(200).json({ success: true, message: 'Phone verified successfully' });
    } catch (error) {
      res.status(400);
      next(error);
    }
  }

  async emergencyContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contacts } = req.body;
      await authService.addEmergencyContacts(req.user.id, contacts);
      res.status(200).json({ success: true, message: 'Emergency contacts saved' });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await authService.resendOtp(email, 'reset_password'); // Generates and sends OTP
      res.status(200).json({ success: true, message: 'Reset password OTP sent to email' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, newPassword } = req.body;
      await authService.verifyOtp(email, otp, 'reset_password');
      await authService.resetPassword(email, newPassword);
      res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      res.status(400);
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { password, ...userWithoutPassword } = req.user;
      res.status(200).json({ success: true, data: { user: userWithoutPassword } });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
