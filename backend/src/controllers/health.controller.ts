import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/health.service';

export class HealthController {
  async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const healthStatus = await healthService.checkHealth();
      res.status(200).json({
        success: true,
        data: healthStatus,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
