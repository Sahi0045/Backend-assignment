import { z } from "zod";
import { TransactionType } from "../../types/enums";

export const VALID_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Dividends",
  "Rental Income",
  "Other Income",
  "Food & Dining",
  "Transportation",
  "Housing",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Shopping",
  "Education",
  "Travel",
  "Insurance",
  "Taxes",
  "Subscriptions",
  "Personal Care",
  "Gifts & Donations",
  "Other Expense",
] as const;

export const createTransactionSchema = z.object({
  amount: z
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .positive("Amount must be a positive number")
    .max(999_999_999.99, "Amount exceeds maximum allowed value")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
  type: z.nativeEnum(TransactionType, {
    errorMap: () => ({ message: "Type must be INCOME or EXPENSE" }),
  }),
  category: z
    .string({ required_error: "Category is required" })
    .min(1, "Category cannot be empty")
    .max(100, "Category cannot exceed 100 characters")
    .trim(),
  date: z
    .string({ required_error: "Date is required" })
    .datetime({ message: "Date must be a valid ISO 8601 datetime string" })
    .transform((val) => new Date(val)),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .trim()
    .optional()
    .nullable(),
});

export const updateTransactionSchema = z
  .object({
    amount: z
      .number()
      .positive("Amount must be positive")
      .max(999_999_999.99)
      .multipleOf(0.01)
      .optional(),
    type: z.nativeEnum(TransactionType).optional(),
    category: z.string().min(1).max(100).trim().optional(),
    date: z
      .string()
      .datetime()
      .transform((val) => new Date(val))
      .optional(),
    notes: z.string().max(1000).trim().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const transactionIdParamSchema = z.object({
  id: z.string().uuid("Invalid transaction ID format"),
});

export const listTransactionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  maxAmount: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  sortBy: z
    .enum(["amount", "date", "category", "type", "createdAt"])
    .optional()
    .default("date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  includeDeleted: z.enum(["true", "false"]).optional().default("false"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
