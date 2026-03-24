import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/services/auth";
import { prisma } from "@/lib/prisma";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      user?: { id: string; isAdmin?: boolean };
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
    req.user = { id: userId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user.isAdmin = true;
    next();
  } catch {
    return res.status(500).json({ error: "Failed to verify admin status" });
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
