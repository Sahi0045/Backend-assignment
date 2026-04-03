import prisma from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import {
  getPaginationParams,
  buildPaginationMeta,
} from "../../utils/pagination";
import { logger } from "../../utils/logger";
import type {
  UpdateUserInput,
  UpdateStatusInput,
  ListUsersQuery,
} from "./user.schema";
import { Prisma } from "@prisma/client";
import { Request } from "express";

// Fields safe to return (never expose password)
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      transactions: { where: { isDeleted: false } },
    },
  },
} as const;

class UserService {
  async listUsers(query: ListUsersQuery, reqQuery: Request["query"]) {
    const { page, limit, skip } = getPaginationParams(reqQuery);
    const {
      role,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SAFE_SELECT,
        orderBy: { [sortBy]: sortOrder } as Prisma.UserOrderByWithRelationInput,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...USER_SAFE_SELECT,
        transactions: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            amount: true,
            type: true,
            category: true,
            date: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) throw ApiError.notFound(`User with ID ${id} not found`);
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput, requesterId: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw ApiError.notFound(`User with ID ${id} not found`);

    // Check email uniqueness if changing
    if (input.email && input.email !== user.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: input.email, deletedAt: null, id: { not: id } },
      });
      if (emailExists) throw ApiError.conflict("Email address already in use");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.role ? { role: input.role } : {}),
      },
      select: USER_SAFE_SELECT,
    });

    logger.info(`User ${id} updated by admin ${requesterId}`);
    return updated;
  }

  async updateStatus(
    id: string,
    input: UpdateStatusInput,
    requesterId: string,
  ) {
    if (id === requesterId) {
      throw ApiError.badRequest(
        "Administrators cannot deactivate their own account",
      );
    }

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw ApiError.notFound(`User with ID ${id} not found`);

    if (user.status === input.status) {
      throw ApiError.badRequest(`User is already ${input.status}`);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: input.status },
      select: USER_SAFE_SELECT,
    });

    // If deactivating, revoke all active refresh tokens
    if (input.status === "INACTIVE") {
      await prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    logger.info(
      `User ${id} status changed to ${input.status} by admin ${requesterId}`,
    );
    return updated;
  }

  async deleteUser(id: string, requesterId: string) {
    if (id === requesterId) {
      throw ApiError.badRequest(
        "Administrators cannot delete their own account",
      );
    }

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw ApiError.notFound(`User with ID ${id} not found`);

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: `deleted_${Date.now()}_${user.email}`, // free up email for reuse
      },
    });

    // Revoke all tokens
    await prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { isRevoked: true },
    });

    logger.warn(
      `User ${id} (${user.email}) soft-deleted by admin ${requesterId}`,
    );
  }

  async getUserStats() {
    const [total, byRole, byStatus] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.groupBy({
        by: ["role"],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { id: true },
      }),
    ]);

    return {
      total,
      byRole: byRole.reduce<Record<string, number>>((acc, cur) => {
        acc[cur.role] = cur._count.id;
        return acc;
      }, {}),
      byStatus: byStatus.reduce<Record<string, number>>((acc, cur) => {
        acc[cur.status] = cur._count.id;
        return acc;
      }, {}),
    };
  }
}

export const userService = new UserService();
