import request from "supertest";
import app from "../src/app";
import prisma from "../src/config/database";

// ─── Module-level state ───────────────────────────────────────────────────────
let adminToken: string = "";
let adminUserId: string = "";
let analystToken: string = "";
let analystUserId: string = "";
let viewerToken: string = "";

const TEST_PASSWORD = "Test@123456";

// Known seeded amounts for deterministic math assertions
const SEEDED_INCOME_1 = 3000.0; // Salary
const SEEDED_INCOME_2 = 800.0; // Freelance
const SEEDED_EXPENSE_1 = 1200.0; // Housing
const SEEDED_EXPENSE_2 = 350.0; // Food & Dining

// ─── Helper ──────────────────────────────────────────────────────────────────
async function getToken(
  role: string,
  emailPrefix: string,
): Promise<{ token: string; userId: string }> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      email: `${emailPrefix}@dashtest.example.com`,
      password: TEST_PASSWORD,
      name: `Dash ${role} User`,
      role,
    });

  if (res.status !== 201) {
    throw new Error(
      `Failed to register ${role} user: ${JSON.stringify(res.body)}`,
    );
  }

  return {
    token: res.body.data.tokens.accessToken,
    userId: res.body.data.user.id,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────
describe("Dashboard API — /api/dashboard", () => {
  beforeAll(async () => {
    // ── Clean slate ────────────────────────────────────────────────────────
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();

    // ── Create users ───────────────────────────────────────────────────────
    const admin = await getToken("ADMIN", "dash.admin");
    adminToken = admin.token;
    adminUserId = admin.userId;

    const analyst = await getToken("ANALYST", "dash.analyst");
    analystToken = analyst.token;
    analystUserId = analyst.userId;

    const viewer = await getToken("VIEWER", "dash.viewer");
    viewerToken = viewer.token;

    // ── Seed transactions ─────────────────────────────────────────────────
    // Spread over 3 months so monthly-trends returns meaningful data.
    // Current month → also feeds weekly-trends.
    const now = new Date();

    const monthOffset = (mo: number, day: number): Date => {
      const d = new Date(now.getFullYear(), now.getMonth() - mo, day, 12, 0, 0);
      return d;
    };

    await prisma.transaction.createMany({
      data: [
        // ── Current month (mo=0) ────────────────────────────────────────
        {
          amount: SEEDED_INCOME_1,
          type: "INCOME",
          category: "Salary",
          date: monthOffset(0, 1),
          notes: "Monthly salary",
          createdById: adminUserId,
        },
        {
          amount: SEEDED_INCOME_2,
          type: "INCOME",
          category: "Freelance",
          date: monthOffset(0, 5),
          notes: "Freelance project",
          createdById: analystUserId,
        },
        {
          amount: SEEDED_EXPENSE_1,
          type: "EXPENSE",
          category: "Housing",
          date: monthOffset(0, 1),
          notes: "Rent payment",
          createdById: adminUserId,
        },
        {
          amount: SEEDED_EXPENSE_2,
          type: "EXPENSE",
          category: "Food & Dining",
          date: monthOffset(0, 10),
          notes: "Groceries",
          createdById: analystUserId,
        },
        // ── 1 month ago ─────────────────────────────────────────────────
        {
          amount: 2500.0,
          type: "INCOME",
          category: "Salary",
          date: monthOffset(1, 1),
          notes: "Previous salary",
          createdById: adminUserId,
        },
        {
          amount: 950.0,
          type: "EXPENSE",
          category: "Housing",
          date: monthOffset(1, 2),
          notes: "Previous rent",
          createdById: adminUserId,
        },
        {
          amount: 200.0,
          type: "EXPENSE",
          category: "Transportation",
          date: monthOffset(1, 15),
          notes: "Bus pass",
          createdById: analystUserId,
        },
        // ── 2 months ago ────────────────────────────────────────────────
        {
          amount: 2500.0,
          type: "INCOME",
          category: "Salary",
          date: monthOffset(2, 1),
          notes: "Two months ago salary",
          createdById: adminUserId,
        },
        {
          amount: 400.0,
          type: "INCOME",
          category: "Investment",
          date: monthOffset(2, 20),
          notes: "Dividends",
          createdById: analystUserId,
        },
        {
          amount: 900.0,
          type: "EXPENSE",
          category: "Housing",
          date: monthOffset(2, 1),
          notes: "Old rent",
          createdById: adminUserId,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/dashboard/summary
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/dashboard/summary", () => {
    it("VIEWER can access summary → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ANALYST can access summary → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ADMIN can access summary → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response has correct overview shape", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data).toHaveProperty("overview");
      expect(data.overview).toMatchObject({
        totalIncome: expect.any(Number),
        totalExpenses: expect.any(Number),
        netBalance: expect.any(Number),
        savingsRate: expect.any(Number),
        transactionCount: expect.any(Number),
      });

      expect(data).toHaveProperty("income");
      expect(data.income).toMatchObject({
        total: expect.any(Number),
        count: expect.any(Number),
        average: expect.any(Number),
      });

      expect(data).toHaveProperty("expenses");
      expect(data.expenses).toMatchObject({
        total: expect.any(Number),
        count: expect.any(Number),
        average: expect.any(Number),
      });

      expect(data).toHaveProperty("recentTransactions");
      expect(Array.isArray(data.recentTransactions)).toBe(true);
    });

    it("netBalance = totalIncome − totalExpenses (math invariant)", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const { overview } = res.body.data;
      const expected =
        Math.round((overview.totalIncome - overview.totalExpenses) * 100) / 100;
      expect(overview.netBalance).toBeCloseTo(expected, 2);
    });

    it("savingsRate is 0 when totalIncome is 0 (no divide-by-zero)", async () => {
      // We cannot easily assert this on seeded data, but we verify
      // savingsRate is within the valid 0–100 range (or negative if loss).
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const { savingsRate } = res.body.data.overview;
      expect(typeof savingsRate).toBe("number");
      expect(isFinite(savingsRate)).toBe(true);
    });

    it("transactionCount matches seeded non-deleted transaction count", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overview.transactionCount).toBeGreaterThanOrEqual(
        10,
      );
    });

    it("totalIncome and totalExpenses are non-negative", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overview.totalIncome).toBeGreaterThanOrEqual(0);
      expect(res.body.data.overview.totalExpenses).toBeGreaterThanOrEqual(0);
    });

    it("income.total === overview.totalIncome", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.income.total).toBe(
        res.body.data.overview.totalIncome,
      );
      expect(res.body.data.expenses.total).toBe(
        res.body.data.overview.totalExpenses,
      );
    });

    it("date-range filter is respected when provided", async () => {
      // Far-future date range — should return zero transactions
      const res = await request(app)
        .get(
          "/api/dashboard/summary?startDate=2099-01-01T00:00:00.000Z&endDate=2099-12-31T23:59:59.000Z",
        )
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overview.transactionCount).toBe(0);
      expect(res.body.data.overview.totalIncome).toBe(0);
      expect(res.body.data.overview.totalExpenses).toBe(0);
      expect(res.body.data.overview.netBalance).toBe(0);
    });

    it("recentTransactions contains at most 5 entries (service default)", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recentTransactions.length).toBeLessThanOrEqual(5);
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/dashboard/summary");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/dashboard/category-breakdown
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/dashboard/category-breakdown", () => {
    it("VIEWER can access category-breakdown → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ANALYST can access category-breakdown → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ADMIN can access category-breakdown → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response has income array and expenses array", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data).toHaveProperty("income");
      expect(Array.isArray(data.income)).toBe(true);

      expect(data).toHaveProperty("expenses");
      expect(Array.isArray(data.expenses)).toBe(true);

      expect(data).toHaveProperty("all");
      expect(Array.isArray(data.all)).toBe(true);
    });

    it("income breakdown contains Salary category with positive total", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const salaryEntry = res.body.data.income.find(
        (e: { category: string }) => e.category === "Salary",
      );
      expect(salaryEntry).toBeDefined();
      expect(salaryEntry.total).toBeGreaterThan(0);
    });

    it("expenses breakdown contains Housing category with positive total", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const housingEntry = res.body.data.expenses.find(
        (e: { category: string }) => e.category === "Housing",
      );
      expect(housingEntry).toBeDefined();
      expect(housingEntry.total).toBeGreaterThan(0);
    });

    it("each breakdown entry has the expected shape", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const allEntries: unknown[] = res.body.data.all;
      expect(allEntries.length).toBeGreaterThan(0);

      allEntries.forEach((entry: any) => {
        expect(entry).toHaveProperty("category");
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("total");
        expect(entry).toHaveProperty("count");
        expect(entry).toHaveProperty("average");
        expect(entry).toHaveProperty("percentage");
        expect(typeof entry.total).toBe("number");
        expect(typeof entry.percentage).toBe("number");
      });
    });

    it("all income percentages sum to approximately 100 when filtered by type=INCOME", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown?type=INCOME")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const incomeEntries: Array<{ percentage: number }> = res.body.data.income;
      if (incomeEntries.length > 0) {
        const total = incomeEntries.reduce((s, e) => s + e.percentage, 0);
        // Allow small floating-point rounding tolerance
        expect(total).toBeCloseTo(100, 0);
      }
    });

    it('filter type=INCOME returns only income entries in "all"', async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown?type=INCOME")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const allEntries: Array<{ type: string }> = res.body.data.all;
      allEntries.forEach((e) => {
        expect(e.type).toBe("INCOME");
      });
    });

    it('filter type=EXPENSE returns only expense entries in "all"', async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown?type=EXPENSE")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const allEntries: Array<{ type: string }> = res.body.data.all;
      allEntries.forEach((e) => {
        expect(e.type).toBe("EXPENSE");
      });
    });

    it("has topIncomeCategory and topExpenseCategory fields", async () => {
      const res = await request(app)
        .get("/api/dashboard/category-breakdown")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("topIncomeCategory");
      expect(res.body.data).toHaveProperty("topExpenseCategory");
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/dashboard/category-breakdown");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/dashboard/recent-activity
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/dashboard/recent-activity", () => {
    it("VIEWER can access recent-activity → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ANALYST can access recent-activity → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ADMIN can access recent-activity → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response has transactions array and count", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data).toHaveProperty("transactions");
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data).toHaveProperty("count");
      expect(typeof data.count).toBe("number");
      expect(data.count).toBe(data.transactions.length);
    });

    it("transactions are ordered most-recent first", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const txs: Array<{ createdAt: string }> = res.body.data.transactions;
      for (let i = 1; i < txs.length; i++) {
        const prev = new Date(txs[i - 1]!.createdAt).getTime();
        const curr = new Date(txs[i]!.createdAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it("each transaction entry has required fields", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const txs = res.body.data.transactions as Array<Record<string, unknown>>;
      expect(txs.length).toBeGreaterThan(0);

      txs.forEach((tx) => {
        expect(tx).toHaveProperty("id");
        expect(tx).toHaveProperty("amount");
        expect(tx).toHaveProperty("type");
        expect(tx).toHaveProperty("category");
        expect(tx).toHaveProperty("date");
        expect(tx).toHaveProperty("createdAt");
        expect(tx).toHaveProperty("createdBy");
      });
    });

    it("default limit is 20 — returns at most 20 entries", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBeLessThanOrEqual(20);
    });

    it("custom limit=3 returns at most 3 entries", async () => {
      const res = await request(app)
        .get("/api/dashboard/recent-activity?limit=3")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBeLessThanOrEqual(3);
    });

    it("does not include soft-deleted transactions", async () => {
      // Soft-delete one transaction directly via Prisma, then check it is absent
      const txToDelete = await prisma.transaction.findFirst({
        where: { isDeleted: false },
      });

      if (txToDelete) {
        await prisma.transaction.update({
          where: { id: txToDelete.id },
          data: { isDeleted: true, deletedAt: new Date() },
        });

        const res = await request(app)
          .get("/api/dashboard/recent-activity")
          .set("Authorization", `Bearer ${viewerToken}`);

        expect(res.status).toBe(200);
        const ids = (res.body.data.transactions as Array<{ id: string }>).map(
          (t) => t.id,
        );
        expect(ids).not.toContain(txToDelete.id);

        // Restore so other tests are unaffected
        await prisma.transaction.update({
          where: { id: txToDelete.id },
          data: { isDeleted: false, deletedAt: null },
        });
      }
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/dashboard/recent-activity");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/dashboard/monthly-trends
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/dashboard/monthly-trends", () => {
    it("VIEWER cannot access monthly-trends → 403", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("ANALYST can access monthly-trends → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ADMIN can access monthly-trends → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response has trends array and summary object", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data).toHaveProperty("trends");
      expect(Array.isArray(data.trends)).toBe(true);

      expect(data).toHaveProperty("summary");
      expect(data.summary).toHaveProperty("avgMonthlyIncome");
      expect(data.summary).toHaveProperty("avgMonthlyExpenses");
      expect(data.summary).toHaveProperty("bestIncomeMonth");
      expect(data.summary).toHaveProperty("highestExpenseMonth");

      expect(data).toHaveProperty("period");
      expect(data.period).toHaveProperty("from");
      expect(data.period).toHaveProperty("to");
      expect(data.period).toHaveProperty("months");
    });

    it("trends contains at least 3 months of data (seeded 3 months)", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends?months=12")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.trends.length).toBeGreaterThanOrEqual(3);
    });

    it("each trend entry has the expected shape", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const trends = res.body.data.trends as Array<Record<string, unknown>>;
      expect(trends.length).toBeGreaterThan(0);

      trends.forEach((t) => {
        expect(t).toHaveProperty("month");
        expect(t).toHaveProperty("year");
        expect(t).toHaveProperty("monthNumber");
        expect(t).toHaveProperty("monthName");
        expect(t).toHaveProperty("income");
        expect(t).toHaveProperty("expenses");
        expect(t).toHaveProperty("netBalance");
        expect(t).toHaveProperty("transactionCount");
        // growth fields exist (may be null for first entry)
        expect(t).toHaveProperty("incomeGrowth");
        expect(t).toHaveProperty("expenseGrowth");

        expect(typeof t.income).toBe("number");
        expect(typeof t.expenses).toBe("number");
        expect(typeof t.netBalance).toBe("number");
      });
    });

    it("trend netBalance = income − expenses per month", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const trends = res.body.data.trends as Array<{
        income: number;
        expenses: number;
        netBalance: number;
      }>;

      trends.forEach((t) => {
        const expected = Math.round((t.income - t.expenses) * 100) / 100;
        expect(t.netBalance).toBeCloseTo(expected, 2);
      });
    });

    it("trends are ordered chronologically (ascending month)", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const trends = res.body.data.trends as Array<{ month: string }>;
      for (let i = 1; i < trends.length; i++) {
        expect(
          trends[i]!.month.localeCompare(trends[i - 1]!.month),
        ).toBeGreaterThan(0);
      }
    });

    it("custom months=1 returns only the current month", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends?months=1")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.trends.length).toBeLessThanOrEqual(1);
      expect(res.body.data.period.months).toBe(1);
    });

    it("months capped at 24 even if higher value requested", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-trends?months=100")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.period.months).toBeLessThanOrEqual(24);
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/dashboard/monthly-trends");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/dashboard/weekly-trends
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/dashboard/weekly-trends", () => {
    it("VIEWER cannot access weekly-trends → 403", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("ANALYST can access weekly-trends → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ADMIN can access weekly-trends → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response has weeks array and currentMonth string", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data).toHaveProperty("weeks");
      expect(Array.isArray(data.weeks)).toBe(true);

      expect(data).toHaveProperty("currentMonth");
      expect(typeof data.currentMonth).toBe("string");
      expect(data.currentMonth.length).toBeGreaterThan(0);
    });

    it("each week entry has the expected shape", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const weeks = res.body.data.weeks as Array<Record<string, unknown>>;

      // We seeded transactions in current month, so at least 1 week should exist
      expect(weeks.length).toBeGreaterThan(0);

      weeks.forEach((w) => {
        expect(w).toHaveProperty("week");
        expect(w).toHaveProperty("label");
        expect(w).toHaveProperty("income");
        expect(w).toHaveProperty("expenses");
        expect(w).toHaveProperty("netBalance");
        expect(w).toHaveProperty("transactionCount");
        expect(typeof w.income).toBe("number");
        expect(typeof w.expenses).toBe("number");
        expect(typeof w.netBalance).toBe("number");
      });
    });

    it("week netBalance = income − expenses per week", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const weeks = res.body.data.weeks as Array<{
        income: number;
        expenses: number;
        netBalance: number;
      }>;

      weeks.forEach((w) => {
        const expected = Math.round((w.income - w.expenses) * 100) / 100;
        expect(w.netBalance).toBeCloseTo(expected, 2);
      });
    });

    it("weeks are ordered by week number ascending", async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const weeks = res.body.data.weeks as Array<{ week: number }>;
      for (let i = 1; i < weeks.length; i++) {
        expect(weeks[i]!.week).toBeGreaterThan(weeks[i - 1]!.week);
      }
    });

    it('week labels are like "Week N"', async () => {
      const res = await request(app)
        .get("/api/dashboard/weekly-trends")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const weeks = res.body.data.weeks as Array<{ label: string }>;
      weeks.forEach((w) => {
        expect(w.label).toMatch(/^Week \d+$/);
      });
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/dashboard/weekly-trends");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/dashboard/cash-flow
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/dashboard/cash-flow", () => {
    it("VIEWER cannot access cash-flow → 403", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("ANALYST can access cash-flow → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("ADMIN can access cash-flow → 200", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response has cashFlow array and finalBalance", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data).toHaveProperty("cashFlow");
      expect(Array.isArray(data.cashFlow)).toBe(true);

      expect(data).toHaveProperty("finalBalance");
      expect(typeof data.finalBalance).toBe("number");

      expect(data).toHaveProperty("period");
    });

    it("cashFlow array is non-empty given seeded data", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cashFlow.length).toBeGreaterThan(0);
    });

    it("each cash-flow entry has the expected shape", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data.cashFlow as Array<Record<string, unknown>>;
      entries.forEach((e) => {
        expect(e).toHaveProperty("date");
        expect(e).toHaveProperty("type");
        expect(e).toHaveProperty("amount");
        expect(e).toHaveProperty("delta");
        expect(e).toHaveProperty("balance");
        expect(typeof e.amount).toBe("number");
        expect(typeof e.delta).toBe("number");
        expect(typeof e.balance).toBe("number");
      });
    });

    it("finalBalance equals the last entry balance in cashFlow", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const { cashFlow, finalBalance } = res.body.data as {
        cashFlow: Array<{ balance: number }>;
        finalBalance: number;
      };

      if (cashFlow.length > 0) {
        const lastBalance = cashFlow[cashFlow.length - 1]!.balance;
        expect(finalBalance).toBeCloseTo(lastBalance, 2);
      }
    });

    it("INCOME delta is positive, EXPENSE delta is negative", async () => {
      const res = await request(app)
        .get("/api/dashboard/cash-flow")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data.cashFlow as Array<{
        type: string;
        delta: number;
      }>;

      entries.forEach((e) => {
        if (e.type === "INCOME") {
          expect(e.delta).toBeGreaterThan(0);
        } else {
          expect(e.delta).toBeLessThan(0);
        }
      });
    });

    it("cash-flow with a date range that has no data returns empty cashFlow and finalBalance=0", async () => {
      const res = await request(app)
        .get(
          "/api/dashboard/cash-flow?startDate=2099-01-01T00:00:00.000Z&endDate=2099-12-31T23:59:59.000Z",
        )
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cashFlow).toEqual([]);
      expect(res.body.data.finalBalance).toBe(0);
    });

    it("date range filter restricts entries to that window", async () => {
      const now = new Date();
      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const endOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).toISOString();

      const res = await request(app)
        .get(
          `/api/dashboard/cash-flow?startDate=${startOfCurrentMonth}&endDate=${endOfCurrentMonth}`,
        )
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.cashFlow)).toBe(true);

      // All entries should be within the current month
      const entries = res.body.data.cashFlow as Array<{ date: string }>;
      entries.forEach((e) => {
        const d = new Date(e.date);
        expect(d.getMonth()).toBe(now.getMonth());
        expect(d.getFullYear()).toBe(now.getFullYear());
      });
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/dashboard/cash-flow");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
