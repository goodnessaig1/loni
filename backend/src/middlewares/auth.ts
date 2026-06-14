import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, no token' });
  }

  try {
    const decoded = verifyToken(token);
    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

    if (!user || user.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Not authorized, user not found' });
    }

    req.user = user[0];
    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, token failed' });
  }
};
