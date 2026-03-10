import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/services/auth";

// Расширяем Express Request глобально
declare global {
  namespace Express {
    interface Request {
      userId: string;
      user?: { id: string };
    }
  }
}

export interface AuthRequest extends Request {
  userId: string;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.slice(7);
  try {
    const userId = verifyAccessToken(token);
    req.userId = userId;
    req.user = { id: userId }; // совместимость с routes использующими req.user
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const botMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const secret = req.headers["x-bot-secret"];
  if (secret !== process.env.BOT_API_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
