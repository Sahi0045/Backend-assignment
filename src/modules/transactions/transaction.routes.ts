import { Router } from "express";
import { transactionController } from "./transaction.controller";
import { authenticate } from "../../middleware/auth.middleware";
import {
  authorize,
  requireAdmin,
  requireAnalyst,
} from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionIdParamSchema,
  listTransactionsQuerySchema,
} from "./transaction.schema";
import { Role } from "../../types/enums";

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: List all transactions with filters and pagination
 *     description: Available to all authenticated users. Admins can also view soft-deleted records.
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search in category and notes
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: minAmount
 *         schema: { type: number }
 *       - in: query
 *         name: maxAmount
 *         schema: { type: number }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [amount, date, category, type, createdAt], default: date }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: string, enum: [true, false], default: false }
 *         description: Admin only - include soft-deleted records
 *     responses:
 *       200:
 *         description: Paginated list of transactions
 */
router.get(
  "/",
  authorize(Role.VIEWER),
  validate(listTransactionsQuerySchema, "query"),
  transactionController.listTransactions,
);

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create a new financial transaction
 *     description: Requires ANALYST or ADMIN role
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 2500.00
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *                 example: INCOME
 *               category:
 *                 type: string
 *                 example: Salary
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T00:00:00.000Z"
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 example: Monthly salary for January
 *     responses:
 *       201:
 *         description: Transaction created
 *       400:
 *         description: Validation error
 *       403:
 *         description: ANALYST role required
 */
router.post(
  "/",
  requireAnalyst,
  validate(createTransactionSchema),
  transactionController.createTransaction,
);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction details
 *       404:
 *         description: Transaction not found
 */
router.get(
  "/:id",
  authorize(Role.VIEWER),
  validate(transactionIdParamSchema, "params"),
  transactionController.getTransactionById,
);

/**
 * @swagger
 * /transactions/{id}:
 *   put:
 *     summary: Update a transaction
 *     description: Requires ANALYST or ADMIN role
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               type: { type: string, enum: [INCOME, EXPENSE] }
 *               category: { type: string }
 *               date: { type: string, format: date-time }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Transaction updated
 *       403:
 *         description: ANALYST role required
 *       404:
 *         description: Transaction not found
 */
router.put(
  "/:id",
  requireAnalyst,
  validate(transactionIdParamSchema, "params"),
  validate(updateTransactionSchema),
  transactionController.updateTransaction,
);

/**
 * @swagger
 * /transactions/{id}:
 *   delete:
 *     summary: Soft delete a transaction
 *     description: Requires ADMIN role. Transaction can be restored.
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction soft-deleted
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Transaction not found
 */
router.delete(
  "/:id",
  requireAdmin,
  validate(transactionIdParamSchema, "params"),
  transactionController.deleteTransaction,
);

/**
 * @swagger
 * /transactions/{id}/restore:
 *   patch:
 *     summary: Restore a soft-deleted transaction
 *     description: Requires ADMIN role
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction restored
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Deleted transaction not found
 */
router.patch(
  "/:id/restore",
  requireAdmin,
  validate(transactionIdParamSchema, "params"),
  transactionController.restoreTransaction,
);

export default router;
