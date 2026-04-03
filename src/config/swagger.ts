import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Data Processing & Access Control API',
      version: '1.0.0',
      description: `
## Finance Backend API

A RESTful API for managing financial records with role-based access control.

### Roles
| Role | Permissions |
|------|------------|
| **VIEWER** | Read transactions, view dashboard summaries |
| **ANALYST** | All VIEWER perms + create/update transactions, view trends |
| **ADMIN** | Full access including user management and deletions |

### Authentication
Use JWT Bearer tokens. Obtain tokens via \`POST /api/auth/login\`.
Include in headers: \`Authorization: Bearer <token>\`
      `,
      contact: {
        name: 'Finance Backend API',
        email: 'admin@finance.local',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['VIEWER', 'ANALYST', 'ADMIN'] },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number', format: 'float' },
            type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
            category: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            notes: { type: 'string', nullable: true },
            createdById: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
            meta: {
              type: 'object',
              nullable: true,
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'object', nullable: true },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@finance.local' },
            password: { type: 'string', format: 'password', example: 'Admin@123456' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@finance.local' },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'SecurePass@123',
              description: 'Min 8 chars, must include uppercase, lowercase, number, and special char',
            },
            name: { type: 'string', example: 'John Doe' },
            role: {
              type: 'string',
              enum: ['VIEWER', 'ANALYST', 'ADMIN'],
              default: 'VIEWER',
              description: 'Only ADMIN can assign roles other than VIEWER',
            },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'Short-lived JWT access token (15m)' },
            refreshToken: { type: 'string', description: 'Long-lived JWT refresh token (7d)' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        CreateTransactionRequest: {
          type: 'object',
          required: ['amount', 'type', 'category', 'date'],
          properties: {
            amount: { type: 'number', format: 'float', minimum: 0.01, example: 1500.00 },
            type: { type: 'string', enum: ['INCOME', 'EXPENSE'], example: 'INCOME' },
            category: { type: 'string', example: 'Salary' },
            date: { type: 'string', format: 'date-time', example: '2024-01-15T09:00:00Z' },
            notes: { type: 'string', nullable: true, example: 'Monthly salary payment' },
          },
        },
        UpdateTransactionRequest: {
          type: 'object',
          properties: {
            amount: { type: 'number', format: 'float', minimum: 0.01 },
            type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
            category: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            notes: { type: 'string', nullable: true },
          },
        },
        UpdateUserRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email', example: 'jane@finance.local' },
            role: { type: 'string', enum: ['VIEWER', 'ANALYST', 'ADMIN'] },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
          },
        },
        DashboardSummary: {
          type: 'object',
          properties: {
            totalIncome: { type: 'number', format: 'float', example: 50000.00 },
            totalExpenses: { type: 'number', format: 'float', example: 32000.00 },
            netBalance: { type: 'number', format: 'float', example: 18000.00 },
            transactionCount: { type: 'integer', example: 120 },
            incomeCount: { type: 'integer', example: 48 },
            expenseCount: { type: 'integer', example: 72 },
            periodStart: { type: 'string', format: 'date-time' },
            periodEnd: { type: 'string', format: 'date-time' },
          },
        },
        MonthlyTrend: {
          type: 'object',
          properties: {
            month: { type: 'string', example: '2024-01' },
            income: { type: 'number', format: 'float', example: 5000.00 },
            expenses: { type: 'number', format: 'float', example: 3200.00 },
            net: { type: 'number', format: 'float', example: 1800.00 },
          },
        },
        CategoryBreakdown: {
          type: 'object',
          properties: {
            category: { type: 'string', example: 'Salary' },
            total: { type: 'number', format: 'float', example: 15000.00 },
            count: { type: 'integer', example: 3 },
            percentage: { type: 'number', format: 'float', example: 30.5 },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Unauthorized: Invalid or expired token',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions to perform this action',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Forbidden: Insufficient permissions',
              },
            },
          },
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Resource not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Validation failed',
                errors: {
                  email: ['Invalid email format'],
                  password: ['Password must be at least 8 characters'],
                },
              },
            },
          },
        },
        InternalServerError: {
          description: 'An unexpected error occurred on the server',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Internal server error',
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints — register, login, refresh, logout' },
      { name: 'Users', description: 'User management (Admin only) — CRUD operations on users' },
      { name: 'Transactions', description: 'Financial records management — create, read, update, soft-delete' },
      { name: 'Dashboard', description: 'Analytics and summary data — summaries, trends, category breakdowns' },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
