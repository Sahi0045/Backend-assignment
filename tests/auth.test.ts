import request from "supertest";
import app from "../src/app";
import prisma from "../src/config/database";

// ─── Shared state ────────────────────────────────────────────────────────────
const testUser = {
  email: "auth.test@example.com",
  password: "Test@123456",
  name: "Auth Test User",
};

let accessToken: string = "";
let refreshToken: string = "";

// ─── Suite ───────────────────────────────────────────────────────────────────
describe("Auth API — /api/auth", () => {
  beforeAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/auth/register
  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /api/auth/register", () => {
    it("registers a new user → 201, returns user (no password) + tokens", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Response envelope
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("timestamp");

      // User object returned — no password field
      const { user, tokens } = res.body.data;
      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email.toLowerCase());
      expect(user.name).toBe(testUser.name);
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("status");
      expect(user).toHaveProperty("createdAt");
      expect(user).not.toHaveProperty("password");

      // Token pair
      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
      expect(tokens).toHaveProperty("expiresIn");
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");

      // Capture for later tests
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    });

    it("rejects duplicate email → 409", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("rejects weak password (too short, no special chars) → 400 with errors", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "newuser@example.com",
          password: "weak",
          name: "New User",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty("errors");
    });

    it("rejects password with no uppercase letter → 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "newuser@example.com",
          password: "alllower@123",
          name: "New User",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects password with no special character → 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "newuser@example.com",
          password: "NoSpecial123",
          name: "New User",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects invalid email → 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "not-an-email",
          password: testUser.password,
          name: testUser.name,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects missing name → 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "noname@example.com", password: testUser.password });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects name that is too short → 400", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "shortname@example.com",
          password: testUser.password,
          name: "A",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("accepts an optional role field (ANALYST) → 201 with correct role", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "analyst.reg@example.com",
        password: testUser.password,
        name: "Analyst Reg",
        role: "ANALYST",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe("ANALYST");
    });

    it("defaults role to VIEWER when role is omitted → 201", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "viewer.reg@example.com",
        password: testUser.password,
        name: "Viewer Reg",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe("VIEWER");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/auth/login
  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /api/auth/login", () => {
    // JWT iat has 1-second precision. If login runs in the same second as
    // register, generateAndStoreTokens produces an identical token value and
    // hits the DB unique constraint (P2002 → 409). Waiting 1.1 s guarantees
    // a different iat second.
    beforeAll(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));
    });

    it("login with valid credentials → 200 with accessToken + refreshToken", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("data");

      const { user, tokens } = res.body.data;

      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email.toLowerCase());
      expect(user).not.toHaveProperty("password");

      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
      expect(tokens).toHaveProperty("expiresIn");

      // Refresh token pair for next tests
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    });

    it("login with wrong password → 401", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: "WrongPass@999" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("login with non-existent email → 401", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "ghost@example.com", password: testUser.password });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("login with missing password field → 400", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("login with missing email field → 400", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: testUser.password });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("login with invalid email format → 400", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-valid", password: testUser.password });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/auth/me
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /api/auth/me", () => {
    it("returns current user when authenticated → 200", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = res.body.data;
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email", testUser.email.toLowerCase());
      expect(user).toHaveProperty("name", testUser.name);
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("status");
      expect(user).toHaveProperty("createdAt");
      expect(user).toHaveProperty("updatedAt");
      expect(user).not.toHaveProperty("password");
    });

    it("rejects request with missing Authorization header → 401", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects request with malformed Authorization header → 401", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Token some-token-here");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects request with invalid token → 401", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer this.is.not.a.valid.jwt");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects request with a randomly-signed JWT → 401", async () => {
      // A structurally-valid JWT but signed with a different secret
      const fakeToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
        ".eyJ1c2VySWQiOiJmYWtlLWlkIiwiZW1haWwiOiJmYWtlQHRlc3QuY29tIiwicm9sZSI6IkFETUlOIn0" +
        ".badSignatureHere";

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/auth/refresh
  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /api/auth/refresh", () => {
    // Same JWT-second-precision reason as above: the refresh endpoint creates
    // a new token; we must ensure it lands in a different second than the
    // login token that was stored in the previous describe block.
    beforeAll(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));
    });

    it("issues new token pair with valid refresh token → 200", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const tokens = res.body.data;
      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
      expect(tokens).toHaveProperty("expiresIn");

      // New tokens are different from the old ones (rotation)
      expect(tokens.accessToken).not.toBe(accessToken);
      expect(tokens.refreshToken).not.toBe(refreshToken);

      // Update for subsequent tests
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    });

    it("rejects the old (rotated-out) refresh token → 401", async () => {
      // The token used in the previous test is now revoked; we have already
      // overwritten `refreshToken`, so use a stale value to simulate reuse.
      const staleToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
        ".eyJ1c2VySWQiOiJvbGQiLCJlbWFpbCI6Im9sZEB0ZXN0LmNvbSIsInJvbGUiOiJWSUVXRVIifQ" +
        ".stale";

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: staleToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects completely invalid refresh token string → 401", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid.refresh.token.value" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects empty refresh token body → 400", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects missing refreshToken field → 400", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/auth/logout
  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /api/auth/logout", () => {
    it("logs out successfully with refreshToken in body → 200", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/logged out/i);
    });

    it("the revoked refresh token can no longer be used → 401", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("logout without Authorization header → 401", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("logout-all revokes all sessions for the user → 200", async () => {
      // Wait >1 s so the re-login JWT iat differs from the refresh-describe token.
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));

      // Re-login to get fresh tokens
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      expect(loginRes.status).toBe(200);
      const freshToken = loginRes.body.data.tokens.accessToken;
      const freshRefresh = loginRes.body.data.tokens.refreshToken;

      const res = await request(app)
        .post("/api/auth/logout-all")
        .set("Authorization", `Bearer ${freshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the refresh token is now invalid
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: freshRefresh });

      expect(refreshRes.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Extra: deactivated user cannot login
  // ──────────────────────────────────────────────────────────────────────────
  describe("Deactivated user", () => {
    it("cannot log in when status is INACTIVE → 403", async () => {
      // Register a fresh user, then deactivate them directly in the DB
      const inactiveEmail = "inactive.user@example.com";
      const regRes = await request(app)
        .post("/api/auth/register")
        .send({
          email: inactiveEmail,
          password: testUser.password,
          name: "Inactive User",
        });

      expect(regRes.status).toBe(201);
      const userId = regRes.body.data.user.id;

      // Deactivate directly through Prisma
      await prisma.user.update({
        where: { id: userId },
        data: { status: "INACTIVE" },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: inactiveEmail, password: testUser.password });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
