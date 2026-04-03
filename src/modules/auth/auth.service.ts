import bcrypt from "bcryptjs";
import { Role } from "../../types/enums";
import prisma from "../../config/database";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { logger } from "../../utils/logger";
import type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from "./auth.schema";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    createdAt: Date;
  };
  tokens: AuthTokens;
}

class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existingUser = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });

    if (existingUser) {
      throw ApiError.conflict("A user with this email address already exists");
    }

    const hashedPassword = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        name: input.name,
        role: input.role ?? Role.VIEWER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info(`New user registered: ${user.email} (${user.role})`);

    const tokens = await this.generateAndStoreTokens(
      user.id,
      user.email,
      user.role,
    );

    return { user, tokens };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });

    if (!user) {
      // Timing-safe: still hash to prevent user enumeration
      await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (user.status === "INACTIVE") {
      throw ApiError.forbidden(
        "Your account has been deactivated. Contact an administrator.",
      );
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    logger.info(`User logged in: ${user.email}`);

    const tokens = await this.generateAndStoreTokens(
      user.id,
      user.email,
      user.role,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  async refreshTokens(input: RefreshTokenInput): Promise<AuthTokens> {
    const decoded = verifyRefreshToken(input.refreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: input.refreshToken,
        userId: decoded.userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw ApiError.unauthorized(
        "Invalid or expired refresh token. Please login again.",
      );
    }

    if (storedToken.user.deletedAt) {
      throw ApiError.unauthorized("User account no longer exists");
    }

    if (storedToken.user.status === "INACTIVE") {
      throw ApiError.forbidden("Account has been deactivated");
    }

    // Rotate: revoke old token, issue new pair
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const tokens = await this.generateAndStoreTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
    );

    logger.debug(`Tokens rotated for user: ${storedToken.user.email}`);
    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { isRevoked: true },
      });
    } else {
      // Revoke ALL tokens for user (logout everywhere)
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }
    logger.info(`User logged out: ${userId}`);
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { transactions: { where: { isDeleted: false } } } },
      },
    });

    if (!user) throw ApiError.notFound("User not found");
    return user;
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) throw ApiError.notFound("User not found");

    const isValid = await bcrypt.compare(input.currentPassword, user.password);
    if (!isValid) {
      throw ApiError.badRequest("Current password is incorrect");
    }

    const hashedNew = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });

    // Revoke all refresh tokens (force re-login)
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    logger.info(`Password changed for user: ${userId}`);
  }

  private async generateAndStoreTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<AuthTokens> {
    const payload = { userId, email, role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Calculate refresh token expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    // Clean up old expired/revoked tokens for this user
    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [{ isRevoked: true }, { expiresAt: { lt: new Date() } }],
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRY,
    };
  }
}

export const authService = new AuthService();
