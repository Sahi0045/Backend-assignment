import { Request, Response, NextFunction } from "express";
import { userService } from "./user.service";
import { ApiResponse } from "../../utils/ApiResponse";

class UserController {
  async listUsers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { users, meta } = await userService.listUsers(
        req.query as any,
        req.query,
      );
      ApiResponse.success(
        res,
        users,
        "Users retrieved successfully",
        200,
        meta,
      );
    } catch (err) {
      next(err);
    }
  }

  async getUserById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id);
      ApiResponse.success(res, user, "User retrieved successfully");
    } catch (err) {
      next(err);
    }
  }

  async updateUser(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await userService.updateUser(
        req.params.id,
        req.body,
        req.user!.id,
      );
      ApiResponse.success(res, user, "User updated successfully");
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await userService.updateStatus(
        req.params.id,
        req.body,
        req.user!.id,
      );
      ApiResponse.success(
        res,
        user,
        `User status updated to ${req.body.status}`,
      );
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await userService.deleteUser(req.params.id, req.user!.id);
      ApiResponse.success(res, null, "User deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  async getUserStats(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await userService.getUserStats();
      ApiResponse.success(res, stats, "User statistics retrieved");
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
