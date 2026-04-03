import { Request, Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { ApiResponse } from "../../utils/ApiResponse";

class DashboardController {
  async getSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };
      const summary = await dashboardService.getSummary({ startDate, endDate });
      ApiResponse.success(res, summary, "Dashboard summary retrieved");
    } catch (err) {
      next(err);
    }
  }

  async getCategoryBreakdown(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { startDate, endDate, type } = req.query as {
        startDate?: string;
        endDate?: string;
        type?: any;
      };
      const breakdown = await dashboardService.getCategoryBreakdown({
        startDate,
        endDate,
        type,
      });
      ApiResponse.success(res, breakdown, "Category breakdown retrieved");
    } catch (err) {
      next(err);
    }
  }

  async getMonthlyTrends(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const months = Math.min(parseInt(req.query.months as string) || 12, 24);
      const trends = await dashboardService.getMonthlyTrends(months);
      ApiResponse.success(res, trends, "Monthly trends retrieved");
    } catch (err) {
      next(err);
    }
  }

  async getWeeklyTrends(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const trends = await dashboardService.getWeeklyTrends();
      ApiResponse.success(res, trends, "Weekly trends retrieved");
    } catch (err) {
      next(err);
    }
  }

  async getRecentActivity(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const activity = await dashboardService.getRecentActivity(limit);
      ApiResponse.success(res, activity, "Recent activity retrieved");
    } catch (err) {
      next(err);
    }
  }

  async getCashFlow(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };
      const cashFlow = await dashboardService.getCashFlow({
        startDate,
        endDate,
      });
      ApiResponse.success(res, cashFlow, "Cash flow data retrieved");
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
