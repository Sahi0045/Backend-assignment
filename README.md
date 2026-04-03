# Finance Data Processing and Access Control Backend

A **production-ready RESTful API** for a finance dashboard system with JWT authentication, role-based access control, and comprehensive analytics.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js + Express.js | Web framework |
| TypeScript | Type safety |
| Prisma ORM | Database abstraction |
| SQLite | Database (zero-setup) |
| JWT (jsonwebtoken) | Authentication tokens |
| Zod | Input validation |
| bcryptjs | Password hashing |
| Swagger/OpenAPI 3.0 | API documentation |
| Jest + Supertest | Testing |
| Winston | Structured logging |
| Helmet + CORS | Security headers |
| express-rate-limit | Rate limiting |

## Architecture

```
src/
├── config/         # Database client, environment config, Swagger spec
├── middleware/     # Auth (JWT verify), RBAC (role guards), validation, error handler
├── modules/        # Feature modules (auth, users, transactions, dashboard)
│   ├── auth/      # Register, login, refresh, logout, profile
│   ├── users/     # User CRUD (Admin only)
│   ├── transactions/ # Financial records CRUD with filters
│   └── dashboard/ # Analytics, summaries, trends
├── types/         # TypeScript declarations + custom enums
└── utils/         # ApiResponse, ApiError, JWT helpers, logger, pagination
```

Each module follows the pattern: **Routes → Controller → Service → Prisma**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed with sample data
npm run db:seed

# 5. Start development server
npm run dev
```

Server starts at `http://localhost:3000`

## Seed Users

| Email | Password | Role |
|---|---|---|
| admin@finance.local | Admin@123456 | ADMIN |
| sarah.analyst@finance.local | Analyst@123456 | ANALYST |
| mike.analyst@finance.local | Analyst@123456 | ANALYST |
| john.viewer@finance.local | Viewer@123456 | VIEWER |

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | None | Register new user |
| POST | /login | None | Login, get tokens |
| POST | /refresh | None | Refresh access token |
| POST | /logout | Bearer | Logout current session |
| POST | /logout-all | Bearer | Logout all devices |
| GET | /me | Bearer | Get current user profile |
| PUT | /change-password | Bearer | Change password |

### Users (`/api/users`) — Admin Only

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | ADMIN | List users (paginated + filters) |
| GET | /stats | ADMIN | User count statistics |
| GET | /:id | ADMIN | Get user by ID |
| PUT | /:id | ADMIN | Update user details |
| PATCH | /:id/status | ADMIN | Activate/deactivate user |
| DELETE | /:id | ADMIN | Soft delete user |

### Transactions (`/api/transactions`)

| Method | Path | Role Required | Description |
|--------|------|--------------|-------------|
| GET | / | VIEWER+ | List all (paginated, filterable) |
| GET | /:id | VIEWER+ | Get transaction by ID |
| POST | / | ANALYST+ | Create transaction |
| PUT | /:id | ANALYST+ | Update transaction |
| DELETE | /:id | ADMIN | Soft delete transaction |
| PATCH | /:id/restore | ADMIN | Restore soft-deleted |

### Dashboard (`/api/dashboard`)

| Method | Path | Role Required | Description |
|--------|------|--------------|-------------|
| GET | /summary | VIEWER+ | Total income, expenses, net balance |
| GET | /category-breakdown | VIEWER+ | Totals per category with % |
| GET | /recent-activity | VIEWER+ | Latest transactions feed |
| GET | /monthly-trends | ANALYST+ | Month-by-month with growth rates |
| GET | /weekly-trends | ANALYST+ | Week breakdown for current month |
| GET | /cash-flow | ANALYST+ | Running balance analysis |

## Role Permissions

| Feature | VIEWER | ANALYST | ADMIN |
|---------|--------|---------|-------|
| View transactions | ✅ | ✅ | ✅ |
| Create transactions | ❌ | ✅ | ✅ |
| Update transactions | ❌ | ✅ | ✅ |
| Delete transactions | ❌ | ❌ | ✅ |
| Restore transactions | ❌ | ❌ | ✅ |
| Dashboard summary | ✅ | ✅ | ✅ |
| Category breakdown | ✅ | ✅ | ✅ |
| Recent activity | ✅ | ✅ | ✅ |
| Monthly trends | ❌ | ✅ | ✅ |
| Weekly trends | ❌ | ✅ | ✅ |
| Cash flow | ❌ | ✅ | ✅ |
| User management | ❌ | ❌ | ✅ |

## Query Filters — Transactions

```
GET /api/transactions?type=INCOME&category=Salary&startDate=2024-01-01T00:00:00.000Z&endDate=2024-12-31T00:00:00.000Z&minAmount=100&maxAmount=5000&search=salary&page=1&limit=20&sortBy=date&sortOrder=desc
```

## Example Requests

### 1. Login

```json
POST /api/auth/login
{
  "email": "admin@finance.local",
  "password": "Admin@123456"
}
```

### 2. Create Transaction (ANALYST+)

```json
POST /api/transactions
Authorization: Bearer <token>
{
  "amount": 5000.00,
  "type": "INCOME",
  "category": "Salary",
  "date": "2024-01-15T00:00:00.000Z",
  "notes": "January salary"
}
```

### 3. Dashboard Summary Response

```json
GET /api/dashboard/summary
{
  "success": true,
  "message": "Dashboard summary retrieved",
  "data": {
    "overview": {
      "totalIncome": 34980.00,
      "totalExpenses": 11158.00,
      "netBalance": 23822.00,
      "savingsRate": 68.10,
      "transactionCount": 24
    },
    "income": { "total": 34980.00, "count": 12, "average": 2915.00 },
    "expenses": { "total": 11158.00, "count": 24, "average": 464.92 },
    "recentTransactions": []
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Standard API Response

All endpoints return a consistent envelope:

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "message": "Validation failed: amount, type",
  "errors": {
    "amount": ["Amount must be a positive number"],
    "type": ["Type must be INCOME or EXPENSE"]
  },
  "timestamp": "..."
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |
| PORT | 3000 | HTTP port |
| DATABASE_URL | file:./dev.db | SQLite file path |
| JWT_ACCESS_SECRET | — | Access token secret (min 32 chars) |
| JWT_REFRESH_SECRET | — | Refresh token secret (min 32 chars) |
| JWT_ACCESS_EXPIRY | 15m | Access token lifetime |
| JWT_REFRESH_EXPIRY | 7d | Refresh token lifetime |
| BCRYPT_ROUNDS | 12 | Password hash rounds |
| RATE_LIMIT_WINDOW_MS | 900000 | Rate limit window (15 min) |
| RATE_LIMIT_MAX | 100 | Max requests per window |
| AUTH_RATE_LIMIT_MAX | 10 | Max auth attempts per window |
| CORS_ORIGIN | * | Allowed CORS origins |

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

Tests use a separate `test.db` file and bypass rate limiting.

## API Documentation

Swagger UI is available at: **http://localhost:3000/api/docs**

OpenAPI JSON spec: `http://localhost:3000/api/docs.json`

## Security Features

- **JWT Rotation**: Refresh tokens are rotated on every use (one-time tokens)
- **Timing-safe login**: Always performs bcrypt hash even for non-existent users (prevents user enumeration)
- **Soft deletes**: User and transaction data is never permanently deleted (unless hard-delete endpoint is used)
- **Token revocation**: Deactivating a user or changing password immediately revokes all active sessions
- **Helmet**: Sets security HTTP headers
- **CORS**: Configurable allowed origins
- **Rate limiting**: Separate limits for auth vs. general API endpoints
- **Input validation**: All inputs validated via Zod with descriptive error messages

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite + Prisma | Zero-setup portability; swap to PostgreSQL by changing `provider` in schema.prisma |
| Soft deletes | Preserves audit trail; admins can restore deleted data |
| Role hierarchy | ADMIN inherits ANALYST which inherits VIEWER — simplifies permission logic |
| JWT refresh rotation | Prevents token reuse attacks |
| Custom enum module | SQLite doesn't support Prisma native enums; const objects with string unions provide identical DX |
| Winston logging | Structured logs with file rotation; easy to ship to log aggregators |
| Zod validation | Runtime type safety at the API boundary with precise field-level error messages |

## Future Improvements (Production)

- Replace SQLite with PostgreSQL
- Store refresh tokens in Redis with TTL
- Add OpenTelemetry tracing
- Containerize with Docker + docker-compose
- Add CI/CD pipeline
- Implement audit log table for all mutations
- Add two-factor authentication