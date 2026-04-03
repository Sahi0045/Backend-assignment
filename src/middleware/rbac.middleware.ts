import { Request, Response, NextFunction } from "express";
import { Role } from "../types/enums";
import { ApiError } from "../utils/ApiError";

// Role hierarchy: VIEWER < ANALYST < ADMIN
const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 1,
  ANALYST: 2,
  ADMIN: 3,
};

/**
 * Middleware factory: allows access if user has AT LEAST the minimum required role level.
 * Usage: authorize(Role.ANALYST) => allows ANALYST and ADMIN
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role as Role];
    const hasPermission = allowedRoles.some(
      (role) => userRoleLevel >= ROLE_HIERARCHY[role],
    );

    if (!hasPermission) {
      const rolesStr = allowedRoles.join(" or ");
      return next(
        ApiError.forbidden(
          `Access denied. This action requires ${rolesStr} role or higher. Your role: ${req.user.role}`,
        ),
      );
    }

    next();
  };
};

/**
 * Shorthand guards
 */
export const requireAdmin = authorize(Role.ADMIN);
export const requireAnalyst = authorize(Role.ANALYST);
export const requireViewer = authorize(Role.VIEWER); // any authenticated user
