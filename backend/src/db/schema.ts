import { pgTable, serial, text, timestamp, boolean, varchar, pgEnum } from 'drizzle-orm/pg-core';

export const healthChecks = pgTable('health_checks', {
  id: serial('id').primaryKey(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const statusEnum = pgEnum('status', ['pregnant', 'newMom']);
export const otpTypeEnum = pgEnum('otp_type', ['email_verification', 'phone_verification', 'reset_password']);

export const users = pgTable('users', {
  id: varchar('id', { length: 12 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  status: statusEnum('status').notNull(),
  trimester: varchar('trimester', { length: 50 }),
  pregnancyWeek: varchar('pregnancy_week', { length: 50 }),
  babyAge: varchar('baby_age', { length: 50 }),
  phone: varchar('phone', { length: 50 }),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  isPhoneVerified: boolean('is_phone_verified').default(false).notNull(),
  profilePicture: varchar('profile_picture', { length: 255 }),
  referralCode: varchar('referral_code', { length: 50 }).unique().notNull(),
  referredBy: varchar('referred_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const otps = pgTable('otps', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  otp: varchar('otp', { length: 6 }).notNull(),
  type: otpTypeEnum('type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emergencyContacts = pgTable('emergency_contacts', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 12 }).references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  relationship: varchar('relationship', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

