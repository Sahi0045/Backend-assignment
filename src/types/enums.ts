/**
 * Custom enum definitions for SQLite compatibility.
 *
 * Prisma does not support native enums with the SQLite connector.
 * These const-object + string-union-type patterns are functionally identical
 * to what Prisma would generate for PostgreSQL, so all existing code that does
 *   import { Role } from '@prisma/client'
 * can be updated to
 *   import { Role } from '../../types/enums'
 * without any other changes.
 *
 * Usage:
 *   Role.ADMIN          → 'ADMIN'  (object property access)
 *   type Role           → 'VIEWER' | 'ANALYST' | 'ADMIN'  (string literal union)
 *   z.nativeEnum(Role)  → works — Zod accepts const objects in nativeEnum
 */

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------
export const Role = {
  VIEWER: 'VIEWER',
  ANALYST: 'ANALYST',
  ADMIN: 'ADMIN',
} as const;

/** String literal union: 'VIEWER' | 'ANALYST' | 'ADMIN' */
export type Role = (typeof Role)[keyof typeof Role];

// ---------------------------------------------------------------------------
// TransactionType
// ---------------------------------------------------------------------------
export const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

/** String literal union: 'INCOME' | 'EXPENSE' */
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

// ---------------------------------------------------------------------------
// UserStatus
// ---------------------------------------------------------------------------
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

/** String literal union: 'ACTIVE' | 'INACTIVE' */
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
