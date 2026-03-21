/**
 * middleware/validate.ts — R4: Zod валидация входных данных
 *
 * Использование:
 *   import { validate } from "@/middleware/validate";
 *   import { z } from "zod";
 *
 *   const Schema = z.object({ amount: z.string().regex(/^\d+$/) });
 *   router.post("/donate", validate(Schema), async (req, res) => {
 *     const { amount } = req.body; // типизировано
 *   });
 */

import { ZodSchema, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";
import { logger } from "@/lib/logger";

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).flatten().fieldErrors;
      logger.warn("[Validate] Invalid input", { path: req.path, errors });
      res.status(400).json({
        error: "INVALID_INPUT",
        details: errors,
      });
      return;
    }
    req.body = result.data; // заменяем body на типизированные данные
    next();
  };

/** Валидация query параметров */
export const validateQuery = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ error: "INVALID_QUERY", details: result.error.flatten().fieldErrors });
      return;
    }
    req.query = result.data;
    next();
  };
