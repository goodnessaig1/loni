import { db } from '../db';
import { users, otps, emergencyContacts } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateId, generateReferralCode, generateOtp } from '../utils/generateId';
import { signToken } from '../utils/jwt';
import { emailService } from './email.service';

export class AuthService {
  async register(data: any) {
    const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const userId = generateId(12);
    const referralCode = generateReferralCode(8);

    const newUser = await db.insert(users).values({
      id: userId,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      status: data.status,
      trimester: data.trimester,
      pregnancyWeek: data.pregnancyWeek,
      babyAge: data.babyAge,
      referralCode,
      referredBy: data.referredBy,
    }).returning();

    // Generate and send Email OTP
    await this.generateAndSendOtp(data.email, 'email_verification');

    return {
      message: 'Registration successful. Please verify your email.',
      userId: newUser[0].id,
      email: newUser[0].email,
    };
  }

  async login(data: any) {
    const user = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (user.length === 0) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(data.password, user[0].password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const token = signToken({ userId: user[0].id });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user[0];

    return {
      token,
      user: userWithoutPassword,
    };
  }

  async generateAndSendOtp(email: string, type: 'email_verification' | 'phone_verification' | 'reset_password') {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(otps).values({
      email,
      otp,
      type,
      expiresAt,
    });

    await emailService.sendOtpEmail(email, otp, type.replace('_', ' '));
  }

  async verifyOtp(email: string, otp: string, type: 'email_verification' | 'phone_verification' | 'reset_password') {
    const validOtp = await db.select().from(otps)
      .where(
        and(
          eq(otps.email, email),
          eq(otps.otp, otp),
          eq(otps.type, type),
          gt(otps.expiresAt, new Date())
        )
      ).limit(1);

    if (validOtp.length === 0) {
      throw new Error('Invalid or expired OTP');
    }

    // Delete the used OTP
    await db.delete(otps).where(eq(otps.id, validOtp[0].id));

    if (type === 'email_verification') {
      await db.update(users).set({ isEmailVerified: true }).where(eq(users.email, email));
    } else if (type === 'phone_verification') {
      await db.update(users).set({ isPhoneVerified: true }).where(eq(users.email, email));
    }

    return true;
  }

  async resendOtp(email: string, type: 'email_verification' | 'phone_verification' | 'reset_password') {
    // Delete existing unused OTPs
    await db.delete(otps).where(and(eq(otps.email, email), eq(otps.type, type)));
    await this.generateAndSendOtp(email, type);
  }

  async addPhone(userId: string, phone: string, email: string) {
    await db.update(users).set({ phone }).where(eq(users.id, userId));
    // Send phone verification OTP to email as requested
    await this.generateAndSendOtp(email, 'phone_verification');
  }

  async addEmergencyContacts(userId: string, contacts: any[]) {
    // Delete existing to replace (or we could just insert)
    await db.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));
    
    const contactValues = contacts.map(c => ({
      userId,
      name: c.name,
      phone: c.phone,
      relationship: c.relationship,
    }));

    await db.insert(emergencyContacts).values(contactValues);
  }

  async resetPassword(email: string, newPassword: string) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.email, email));
  }
}

export const authService = new AuthService();
