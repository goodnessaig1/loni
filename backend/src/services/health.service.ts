import { db } from '../db';
import { healthChecks } from '../db/schema';

export class HealthService {
  async checkHealth() {
    // Perform a simple DB query to ensure the DB connection works
    try {
      await db.select().from(healthChecks).limit(1);
      return {
        status: 'UP',
        database: 'Connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'UP',
        database: 'Disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const healthService = new HealthService();
