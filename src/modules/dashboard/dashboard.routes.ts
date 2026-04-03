import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize, requireAnalyst } from "../../middleware/rbac.middleware";
import { Role } from "../../types/enums";

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Get financial summary overview
 *     description: Returns total income, expenses, net balance, savings rate. Available to all roles.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *         description: Optional start date filter
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *         description: Optional end date filter
 *     responses:
 *       200:
 *         description: Financial summary
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 overview:
 *                   totalIncome: 15000.00
 *                   totalExpenses: 8500.00
 *                   netBalance: 6500.00
 *                   savingsRate: 43.33
 *                   transactionCount: 47
 */
router.get("/summary", authorize(Role.VIEWER), dashboardController.getSummary);

/**
 * @swagger
 * /dashboard/category-breakdown:
 *   get:
 *     summary: Get category-wise breakdown of transactions
 *     description: Returns totals and percentages for each category. Available to all roles.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *         description: Filter by transaction type
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Category breakdown with percentages
 */
router.get(
  "/category-breakdown",
  authorize(Role.VIEWER),
  dashboardController.getCategoryBreakdown,
);

/**
 * @swagger
 * /dashboard/recent-activity:
 *   get:
 *     summary: Get recent transaction activity feed
 *     description: Returns most recent transactions. Available to all roles.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Recent transactions list
 */
router.get(
  "/recent-activity",
  authorize(Role.VIEWER),
  dashboardController.getRecentActivity,
);

/**
 * @swagger
 * /dashboard/monthly-trends:
 *   get:
 *     summary: Get monthly income vs expense trends
 *     description: Returns month-by-month breakdown with growth rates. Requires ANALYST or higher.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 12, maximum: 24 }
 *         description: Number of months to look back
 *     responses:
 *       200:
 *         description: Monthly trends with growth rates
 *       403:
 *         description: ANALYST role required
 */
router.get(
  "/monthly-trends",
  requireAnalyst,
  dashboardController.getMonthlyTrends,
);

/**
 * @swagger
 * /dashboard/weekly-trends:
 *   get:
 *     summary: Get weekly breakdown for current month
 *     description: Requires ANALYST or higher.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Weekly trends for current month
 */
router.get(
  "/weekly-trends",
  requireAnalyst,
  dashboardController.getWeeklyTrends,
);

/**
 * @swagger
 * /dashboard/cash-flow:
 *   get:
 *     summary: Get running cash flow analysis
 *     description: Returns transaction-by-transaction running balance. Requires ANALYST or higher.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Cash flow data with running balance
 */
router.get("/cash-flow", requireAnalyst, dashboardController.getCashFlow);

export default router;
