import { Request, Response, NextFunction } from 'express';
import { transactionService } from './transaction.service';
import { ApiResponse } from '../../utils/ApiResponse';

class TransactionController {
  async createTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await transactionService.createTransaction(req.body, req.user!.id);
      ApiResponse.created(res, transaction, 'Transaction created successfully');
    } catch (err) {
      next(err);
    }
  }

  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactions, meta } = await transactionService.listTransactions(
        req.query as any,
        req.query,
        req.user!.role
      );
      ApiResponse.success(res, transactions, 'Transactions retrieved successfully', 200, meta);
    } catch (err) {
      next(err);
    }
  }

  async getTransactionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await transactionService.getTransactionById(
        req.params.id,
        req.user!.role
      );
      ApiResponse.success(res, transaction, 'Transaction retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await transactionService.updateTransaction(
        req.params.id,
        req.body,
        req.user!.id,
        req.user!.role
      );
      ApiResponse.success(res, transaction, 'Transaction updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await transactionService.deleteTransaction(req.params.id, req.user!.id);
      ApiResponse.success(res, transaction, 'Transaction deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async restoreTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await transactionService.restoreTransaction(req.params.id, req.user!.id);
      ApiResponse.success(res, transaction, 'Transaction restored successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const transactionController = new TransactionController();
