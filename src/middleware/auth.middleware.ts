import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import prisma from "../config/database";
import { logger } from "../utils/logger";
import { Role } from "../types/enums";

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized(
        "Authorization header missing or malformed. Use: Bearer <token>",
      );
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw ApiError.unauthorized("Token not provided");
    }

    const decoded = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        deletedAt: null,
      },
      select: { id: true, email: true, role: true, name: true, status: true },
    });

    if (!user) {
      throw ApiError.unauthorized("User account not found");
    }

    if (user.status === "INACTIVE") {
      throw ApiError.forbidden(
        "Your account has been deactivated. Contact an administrator.",
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      // Prisma returns String for role (SQLite has no native enum).
      // Cast is safe: the DB always contains a valid Role value enforced at write time.
      role: user.role as Role,
      name: user.name,
    };

    next();
  } catch (err) {
    logger.debug(`Auth middleware error: ${(err as Error).message}`);
    next(err);
  }
};
