import { Prisma } from "@prisma/client";
import prisma from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import {
  getPaginationParams,
  buildPaginationMeta,
} from "../../utils/pagination";
import { logger } from "../../utils/logger";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
} from "./transaction.schema";
import { Request } from "express";

const TRANSACTION_SELECT = {
  id: true,
  amount: true,
  type: true,
  category: true,
  date: true,
  notes: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

class TransactionService {
  async createTransaction(input: CreateTransactionInput, userId: string) {
    const transaction = await prisma.transaction.create({
      data: {
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: input.date,
        notes: input.notes ?? null,
        createdById: userId,
      },
      select: TRANSACTION_SELECT,
    });

    logger.info(
      `Transaction created: ${transaction.id} by user ${userId} (${input.type}: ${input.amount})`,
    );
    return transaction;
  }

  async listTransactions(
    query: ListTransactionsQuery,
    reqQuery: Request["query"],
    userRole: string,
  ) {
    const { page, limit, skip } = getPaginationParams(reqQuery);
    const {
      type,
      category,
      search,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "date",
      sortOrder = "desc",
      includeDeleted,
    } = query;

    // Only admins can see deleted records
    const showDeleted = includeDeleted === "true" && userRole === "ADMIN";

    const where: Prisma.TransactionWhereInput = {
      ...(showDeleted ? {} : { isDeleted: false }),
      ...(type ? { type } : {}),
      ...(category ? { category: { contains: category } } : {}),
      ...(search
        ? {
            OR: [
              { category: { contains: search } },
              { notes: { contains: search } },
            ],
          }
        : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(minAmount !== undefined || maxAmount !== undefined
        ? {
            amount: {
              ...(minAmount !== undefined ? { gte: minAmount } : {}),
              ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
            },
          }
        : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: TRANSACTION_SELECT,
        orderBy: {
          [sortBy]: sortOrder,
        } as Prisma.TransactionOrderByWithRelationInput,
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getTransactionById(id: string, userRole: string) {
    const where: Prisma.TransactionWhereInput = {
      id,
      ...(userRole !== "ADMIN" ? { isDeleted: false } : {}),
    };

    const transaction = await prisma.transaction.findFirst({
      where,
      select: TRANSACTION_SELECT,
    });

    if (!transaction)
      throw ApiError.notFound(`Transaction with ID ${id} not found`);
    return transaction;
  }

  async updateTransaction(
    id: string,
    input: UpdateTransactionInput,
    userId: string,
    _userRole: string,
  ) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, isDeleted: false },
    });

    if (!transaction)
      throw ApiError.notFound(`Transaction with ID ${id} not found`);

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.date ? { date: input.date } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      select: TRANSACTION_SELECT,
    });

    logger.info(`Transaction ${id} updated by user ${userId}`);
    return updated;
  }

  async deleteTransaction(id: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, isDeleted: false },
    });

    if (!transaction)
      throw ApiError.notFound(`Transaction with ID ${id} not found`);

    const deleted = await prisma.transaction.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      select: TRANSACTION_SELECT,
    });

    logger.warn(`Transaction ${id} soft-deleted by admin ${userId}`);
    return deleted;
  }

  async restoreTransaction(id: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, isDeleted: true },
    });

    if (!transaction) {
      throw ApiError.notFound(`Deleted transaction with ID ${id} not found`);
    }

    const restored = await prisma.transaction.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
      select: TRANSACTION_SELECT,
    });

    logger.info(`Transaction ${id} restored by admin ${userId}`);
    return restored;
  }

  async hardDeleteTransaction(id: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({ where: { id } });
    if (!transaction)
      throw ApiError.notFound(`Transaction with ID ${id} not found`);

    await prisma.transaction.delete({ where: { id } });
    logger.warn(`Transaction ${id} permanently deleted by admin ${userId}`);
  }
}

export const transactionService = new TransactionService();
