import request from "supertest";
import app from "../src/app";
import prisma from "../src/config/database";

// ─── Module-level state ───────────────────────────────────────────────────────
let viewerToken: string = "";
let analystToken: string = "";
let adminToken: string = "";

let adminUserId: string = "";

/** ID captured from the first successful POST — used for GET/:id and PUT/:id */
let createdTransactionId: string = "";
/** Pre-created in beforeAll so delete/restore tests are self-contained */
let transactionToDeleteId: string = "";

const TEST_PASSWORD = "Test@123456";

// ─── Helper ──────────────────────────────────────────────────────────────────
async function getAuthToken(
  role: string,
  emailPrefix: string,
): Promise<{ token: string; userId: string }> {
  const email = `${emailPrefix}@txtest.example.com`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: TEST_PASSWORD, name: `TX ${role} User`, role });

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
describe("Transactions API — /api/transactions", () => {
  beforeAll(async () => {
    // Clean slate
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();

    // Create one user per role
    const viewer = await getAuthToken("VIEWER", "tx.viewer");
    const analyst = await getAuthToken("ANALYST", "tx.analyst");
    const admin = await getAuthToken("ADMIN", "tx.admin");

    viewerToken = viewer.token;
    analystToken = analyst.token;
    adminToken = admin.token;

    adminUserId = admin.userId;

    // Pre-create a transaction dedicated to the DELETE → RESTORE test flow
    const tx = await prisma.transaction.create({
      data: {
        amount: 250.0,
        type: "EXPENSE",
        category: "Shopping",
        date: new Date("2024-02-10T12:00:00.000Z"),
        notes: "Pre-created for delete/restore tests",
        createdById: adminUserId,
      },
    });
    transactionToDeleteId = tx.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/transactions
  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /api/transactions", () => {
    it("ANALYST creates INCOME transaction → 201", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 5000.0,
          type: "INCOME",
          category: "Salary",
          date: "2024-01-15T00:00:00.000Z",
          notes: "January salary",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.amount).toBe(5000);
      expect(res.body.data.type).toBe("INCOME");
      expect(res.body.data.category).toBe("Salary");
      expect(res.body.data.isDeleted).toBe(false);
      expect(res.body.data).toHaveProperty("createdBy");

      // Capture for subsequent GET/:id and PUT/:id tests
      createdTransactionId = res.body.data.id;
    });

    it("ADMIN creates EXPENSE transaction → 201", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          amount: 1200.5,
          type: "EXPENSE",
          category: "Housing",
          date: "2024-01-01T00:00:00.000Z",
          notes: "Monthly rent",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("EXPENSE");
      expect(res.body.data.amount).toBe(1200.5);
      expect(res.body.data).toHaveProperty("id");
    });

    it("VIEWER cannot create transaction → 403", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          amount: 100.0,
          type: "INCOME",
          category: "Freelance",
          date: "2024-01-10T00:00:00.000Z",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).post("/api/transactions").send({
        amount: 100.0,
        type: "INCOME",
        category: "Freelance",
        date: "2024-01-10T00:00:00.000Z",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("negative amount rejected → 400 with errors", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: -500,
          type: "INCOME",
          category: "Salary",
          date: "2024-01-15T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty("errors");
    });

    it("zero amount rejected → 400", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 0,
          type: "INCOME",
          category: "Salary",
          date: "2024-01-15T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("invalid type rejected → 400 with errors", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 500,
          type: "TRANSFER",
          category: "Salary",
          date: "2024-01-15T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty("errors");
    });

    it("missing amount rejected → 400", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          type: "INCOME",
          category: "Salary",
          date: "2024-01-15T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("missing date rejected → 400", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 500,
          type: "INCOME",
          category: "Salary",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("missing category rejected → 400", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 500,
          type: "INCOME",
          date: "2024-01-15T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("invalid date format rejected → 400", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 500,
          type: "INCOME",
          category: "Salary",
          date: "not-a-valid-date",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("amount with more than 2 decimal places rejected → 400", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 100.123,
          type: "INCOME",
          category: "Salary",
          date: "2024-01-15T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("creates transaction without optional notes field → 201, notes is null", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          amount: 200.0,
          type: "INCOME",
          category: "Freelance",
          date: "2024-01-20T00:00:00.000Z",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/transactions
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/transactions", () => {
    it("VIEWER can list transactions → 200 with array + meta", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty("meta");
      expect(res.body.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNextPage: expect.any(Boolean),
        hasPreviousPage: expect.any(Boolean),
      });
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it("ANALYST can list transactions → 200", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("ADMIN can list transactions → 200", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("filters by type=INCOME → only INCOME transactions returned", async () => {
      const res = await request(app)
        .get("/api/transactions?type=INCOME")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((tx: { type: string }) => {
        expect(tx.type).toBe("INCOME");
      });
    });

    it("filters by type=EXPENSE → only EXPENSE transactions returned", async () => {
      const res = await request(app)
        .get("/api/transactions?type=EXPENSE")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((tx: { type: string }) => {
        expect(tx.type).toBe("EXPENSE");
      });
    });

    it("pagination works — page=1&limit=1 returns exactly 1 result", async () => {
      const res = await request(app)
        .get("/api/transactions?page=1&limit=1")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(1);
    });

    it("pagination: hasNextPage=true and hasPreviousPage=false on page 1 when total > 1", async () => {
      const res = await request(app)
        .get("/api/transactions?page=1&limit=1")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      if (res.body.meta.total > 1) {
        expect(res.body.meta.hasNextPage).toBe(true);
        expect(res.body.meta.hasPreviousPage).toBe(false);
      }
    });

    it("does not return soft-deleted transactions for VIEWER by default", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((tx: { isDeleted: boolean }) => {
        expect(tx.isDeleted).toBe(false);
      });
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get("/api/transactions");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("invalid type query param → 400", async () => {
      const res = await request(app)
        .get("/api/transactions?type=INVALID_TYPE")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("category filter returns matching records", async () => {
      const res = await request(app)
        .get("/api/transactions?category=Salary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/transactions/:id
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/transactions/:id", () => {
    it("VIEWER retrieves existing transaction → 200", async () => {
      expect(createdTransactionId).toBeTruthy();

      const res = await request(app)
        .get(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: createdTransactionId,
        amount: expect.any(Number),
        type: expect.any(String),
        category: expect.any(String),
        isDeleted: false,
      });
      expect(res.body.data).toHaveProperty("createdBy");
      expect(res.body.data).toHaveProperty("date");
    });

    it("ANALYST retrieves transaction → 200", async () => {
      const res = await request(app)
        .get(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdTransactionId);
    });

    it("ADMIN retrieves transaction → 200", async () => {
      const res = await request(app)
        .get(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("non-existent UUID → 404", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .get(`/api/transactions/${nonExistentId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("invalid UUID format → 400", async () => {
      const res = await request(app)
        .get("/api/transactions/not-a-valid-uuid")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("unauthenticated request → 401", async () => {
      const res = await request(app).get(
        `/api/transactions/${createdTransactionId}`,
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /api/transactions/:id
  // ──────────────────────────────────────────────────────────────────────────
  describe("PUT /api/transactions/:id", () => {
    it("ANALYST updates notes → 200 with updated field", async () => {
      expect(createdTransactionId).toBeTruthy();

      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${analystToken}`)
        .send({ notes: "Updated by analyst in test" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBe("Updated by analyst in test");
      expect(res.body.data.id).toBe(createdTransactionId);
    });

    it("ANALYST updates amount → 200", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${analystToken}`)
        .send({ amount: 5500.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(5500);
    });

    it("ADMIN can update transaction → 200", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "Updated by admin in test" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBe("Updated by admin in test");
    });

    it("VIEWER cannot update transaction → 403", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ notes: "Viewer should be denied" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("empty update body rejected → 400", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${analystToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("update with negative amount → 400", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${analystToken}`)
        .send({ amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("update with invalid type → 400", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .set("Authorization", `Bearer ${analystToken}`)
        .send({ type: "INVALID" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("update non-existent transaction → 404", async () => {
      const res = await request(app)
        .put("/api/transactions/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({ notes: "Should not exist" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("update with invalid UUID → 400", async () => {
      const res = await request(app)
        .put("/api/transactions/not-a-uuid")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({ notes: "Invalid ID" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("unauthenticated update → 401", async () => {
      const res = await request(app)
        .put(`/api/transactions/${createdTransactionId}`)
        .send({ notes: "Unauthenticated" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/transactions/:id
  // Tests share state with the RESTORE suite below — run in declaration order.
  // ──────────────────────────────────────────────────────────────────────────
  describe("DELETE /api/transactions/:id", () => {
    it("ANALYST cannot delete transaction → 403", async () => {
      expect(transactionToDeleteId).toBeTruthy();

      const res = await request(app)
        .delete(`/api/transactions/${transactionToDeleteId}`)
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("VIEWER cannot delete transaction → 403", async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionToDeleteId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("ADMIN soft-deletes transaction → 200, isDeleted=true", async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionToDeleteId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(true);
      expect(res.body.data.deletedAt).not.toBeNull();
      expect(res.body.data.id).toBe(transactionToDeleteId);
    });

    it("VIEWER cannot see soft-deleted transaction → 404", async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionToDeleteId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("ANALYST cannot see soft-deleted transaction → 404", async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionToDeleteId}`)
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("soft-deleted transaction is absent from VIEWER list", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ id: string }>).map((tx) => tx.id);
      expect(ids).not.toContain(transactionToDeleteId);
    });

    it("delete non-existent UUID → 404", async () => {
      const res = await request(app)
        .delete("/api/transactions/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("delete with invalid UUID format → 400", async () => {
      const res = await request(app)
        .delete("/api/transactions/not-a-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("unauthenticated delete → 401", async () => {
      const res = await request(app).delete(
        `/api/transactions/${transactionToDeleteId}`,
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /api/transactions/:id/restore
  // ──────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/transactions/:id/restore", () => {
    it("ANALYST cannot restore soft-deleted transaction → 403", async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionToDeleteId}/restore`)
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("VIEWER cannot restore soft-deleted transaction → 403", async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionToDeleteId}/restore`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("ADMIN restores soft-deleted transaction → 200, isDeleted=false", async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionToDeleteId}/restore`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(false);
      expect(res.body.data.deletedAt).toBeNull();
      expect(res.body.data.id).toBe(transactionToDeleteId);
    });

    it("restored transaction is visible to VIEWER again → 200", async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionToDeleteId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(false);
    });

    it("restoring a non-deleted (active) transaction → 404", async () => {
      // createdTransactionId was never deleted, so the service returns 404
      const res = await request(app)
        .patch(`/api/transactions/${createdTransactionId}/restore`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("restore with invalid UUID format → 400", async () => {
      const res = await request(app)
        .patch("/api/transactions/not-a-uuid/restore")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("unauthenticated restore → 401", async () => {
      const res = await request(app).patch(
        `/api/transactions/${transactionToDeleteId}/restore`,
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
