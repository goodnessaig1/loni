// import { Request, Response, NextFunction } from 'express';
// import { z, ZodError } from 'zod';

// export const validate = (schema: z.ZodSchema) => {
//   return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//     try {
//       await schema.parseAsync({
//         body: req.body,
//         query: req.query,
//         params: req.params,
//       });
//       next();
//     } catch (error) {
//       if (error instanceof ZodError) {
//         res.status(400).json({ error: (error as any).errors || (error as any).issues });
//         return;
//       }
//       res.status(400).json({ error: 'Invalid request data' });
//       return;
//     }
//   };
// };

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.issues.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  };
};
