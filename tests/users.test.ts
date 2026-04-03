import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

// ─── Module-level state ───────────────────────────────────────────────────────
let adminToken: string = '';
let adminUserId: string = '';
let viewerToken: string = '';
let viewerId: string = '';
let analystToken: string = '';
let analystId: string = '';
/** A dedicated user we can safely mutate (update/status/delete) without
 *  affecting other tests that rely on the viewer/analyst accounts. */
let targetUserId: string = '';
let targetUserEmail: string = '';

const TEST_PASSWORD = 'Test@123456';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAdminToken(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'users.admin@example.com',
      password: TEST_PASSWORD,
      name: 'Users Admin',
      role: 'ADMIN',
    });

  if (res.status !== 201) {
    throw new Error(`Admin registration failed: ${JSON.stringify(res.body)}`);
  }

  adminUserId = res.body.data.user.id;
  return res.body.data.tokens.accessToken;
}

async function registerUser(
  emailPrefix: string,
  name: string,
  role: string,
): Promise<{ token: string; userId: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `${emailPrefix}@example.com`,
      password: TEST_PASSWORD,
      name,
      role,
    });

  if (res.status !== 201) {
    throw new Error(
      `User registration failed (${role}): ${JSON.stringify(res.body)}`,
    );
  }

  return {
    token: res.body.data.tokens.accessToken,
    userId: res.body.data.user.id,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────
describe('Users API — /api/users', () => {
  beforeAll(async () => {
    // Clean slate
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();

    // Admin
    adminToken = await getAdminToken();

    // Viewer
    const viewer = await registerUser('users.viewer', 'Users Viewer', 'VIEWER');
    viewerToken = viewer.token;
    viewerId = viewer.userId;

    // Analyst
    const analyst = await registerUser(
      'users.analyst',
      'Users Analyst',
      'ANALYST',
    );
    analystToken = analyst.token;
    analystId = analyst.userId;

    // Target user — used for update / status / delete tests
    targetUserEmail = 'users.target@example.com';
    const target = await registerUser('users.target', 'Target User', 'VIEWER');
    targetUserId = target.userId;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/users
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/users', () => {
    it('ADMIN can list all users → 200 with array + meta', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNextPage: expect.any(Boolean),
        hasPreviousPage: expect.any(Boolean),
      });
      // Passwords must never be exposed
      res.body.data.forEach((u: Record<string, unknown>) => {
        expect(u).not.toHaveProperty('password');
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('email');
        expect(u).toHaveProperty('name');
        expect(u).toHaveProperty('role');
        expect(u).toHaveProperty('status');
      });
    });

    it('VIEWER cannot list users → 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ANALYST cannot list users → 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated request → 401', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('filter by role=VIEWER → only VIEWER users returned', async () => {
      const res = await request(app)
        .get('/api/users?role=VIEWER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((u: { role: string }) => {
        expect(u.role).toBe('VIEWER');
      });
    });

    it('filter by role=ADMIN → only ADMIN users returned', async () => {
      const res = await request(app)
        .get('/api/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((u: { role: string }) => {
        expect(u.role).toBe('ADMIN');
      });
    });

    it('filter by status=ACTIVE → only ACTIVE users returned', async () => {
      const res = await request(app)
        .get('/api/users?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((u: { status: string }) => {
        expect(u.status).toBe('ACTIVE');
      });
    });

    it('search by name fragment → 200 with matching users', async () => {
      const res = await request(app)
        .get('/api/users?search=Target')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // At least the "Target User" should appear
      const names: string[] = res.body.data.map(
        (u: { name: string }) => u.name,
      );
      expect(names.some((n) => n.toLowerCase().includes('target'))).toBe(true);
    });

    it('search by email fragment → 200', async () => {
      const res = await request(app)
        .get('/api/users?search=users.viewer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('pagination: page=1&limit=2 returns at most 2 users', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.page).toBe(1);
    });

    it('invalid role filter → 400', async () => {
      const res = await request(app)
        .get('/api/users?role=SUPERADMIN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('invalid status filter → 400', async () => {
      const res = await request(app)
        .get('/api/users?status=BANNED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/users/stats
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/users/stats', () => {
    it('ADMIN gets stats with total, byRole, byStatus → 200', async () => {
      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('byRole');
      expect(res.body.data).toHaveProperty('byStatus');

      expect(typeof res.body.data.total).toBe('number');
      expect(res.body.data.total).toBeGreaterThan(0);

      // byRole is an object keyed by role names
      expect(typeof res.body.data.byRole).toBe('object');
      // byStatus contains at least ACTIVE
      expect(typeof res.body.data.byStatus).toBe('object');
      expect(res.body.data.byStatus).toHaveProperty('ACTIVE');

      // Counts should add up
      const roleTotal = Object.values(res.body.data.byRole as Record<string, number>).reduce(
        (sum, v) => sum + v,
        0,
      );
      expect(roleTotal).toBe(res.body.data.total);
    });

    it('stats reflect the seeded users — ADMIN count is at least 1', async () => {
      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.byRole['ADMIN']).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byRole['VIEWER']).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byRole['ANALYST']).toBeGreaterThanOrEqual(1);
    });

    it('VIEWER cannot access stats → 403', async () => {
      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ANALYST cannot access stats → 403', async () => {
      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated request → 401', async () => {
      const res = await request(app).get('/api/users/stats');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/users/:id
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/users/:id', () => {
    it('ADMIN gets user by ID → 200 with full user object', async () => {
      const res = await request(app)
        .get(`/api/users/${viewerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: viewerId,
        role: 'VIEWER',
        status: 'ACTIVE',
      });
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
    });

    it('ADMIN gets analyst by ID → 200', async () => {
      const res = await request(app)
        .get(`/api/users/${analystId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(analystId);
      expect(res.body.data.role).toBe('ANALYST');
    });

    it('ADMIN gets their own record → 200', async () => {
      const res = await request(app)
        .get(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(adminUserId);
      expect(res.body.data.role).toBe('ADMIN');
    });

    it('VIEWER cannot access user by ID → 403', async () => {
      const res = await request(app)
        .get(`/api/users/${viewerId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ANALYST cannot access user by ID → 403', async () => {
      const res = await request(app)
        .get(`/api/users/${analystId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('non-existent UUID → 404', async () => {
      const res = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('invalid UUID format → 400', async () => {
      const res = await request(app)
        .get('/api/users/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated request → 401', async () => {
      const res = await request(app).get(`/api/users/${viewerId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /api/users/:id
  // ──────────────────────────────────────────────────────────────────────────
  describe('PUT /api/users/:id', () => {
    it('ADMIN updates target user name → 200 with updated name', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Target Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Target Name');
      expect(res.body.data.id).toBe(targetUserId);
    });

    it('ADMIN updates target user role to ANALYST → 200', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ANALYST' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('ANALYST');
    });

    it('ADMIN updates name and role together → 200 with both fields updated', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Target Renamed', role: 'VIEWER' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Target Renamed');
      expect(res.body.data.role).toBe('VIEWER');
    });

    it('ADMIN updates target user email → 200', async () => {
      const newEmail = 'users.target.updated@example.com';
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: newEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(newEmail);

      // Track new email
      targetUserEmail = newEmail;
    });

    it('VIEWER cannot update user → 403', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Viewer Should Fail' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ANALYST cannot update user → 403', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ name: 'Analyst Should Fail' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('empty update body → 400', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('invalid role value → 400', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SUPERUSER' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('invalid email format → 400', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-valid-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('email already taken by another user → 409', async () => {
      // viewer's email is 'users.viewer@example.com'; try to assign it to target
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'users.viewer@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('update non-existent UUID → 404', async () => {
      const res = await request(app)
        .put('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost User' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('update with invalid UUID format → 400', async () => {
      const res = await request(app)
        .put('/api/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost User' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated update → 401', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUserId}`)
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /api/users/:id/status
  // ──────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/users/:id/status', () => {
    it('ADMIN deactivates target user → 200, status=INACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('INACTIVE');
      expect(res.body.data.id).toBe(targetUserId);
    });

    it('deactivated user cannot log in → 403', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: targetUserEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN reactivates target user → 200, status=ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.id).toBe(targetUserId);
    });

    it('reactivated user can log in again → 200', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: targetUserEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('setting the same status as current → 400', async () => {
      // Target is ACTIVE; trying to set ACTIVE again
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN cannot deactivate their own account → 400', async () => {
      const res = await request(app)
        .patch(`/api/users/${adminUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('VIEWER cannot change status → 403', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ANALYST cannot change status → 403', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('invalid status value → 400', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('missing status field → 400', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('non-existent UUID → 404', async () => {
      const res = await request(app)
        .patch('/api/users/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('invalid UUID format → 400', async () => {
      const res = await request(app)
        .patch('/api/users/not-a-uuid/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated status change → 401', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/status`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/users/:id
  // ──────────────────────────────────────────────────────────────────────────
  describe('DELETE /api/users/:id', () => {
    it('VIEWER cannot soft-delete a user → 403', async () => {
      const res = await request(app)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ANALYST cannot soft-delete a user → 403', async () => {
      const res = await request(app)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN cannot delete their own account → 400', async () => {
      const res = await request(app)
        .delete(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN soft-deletes target user → 200', async () => {
      const res = await request(app)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('soft-deleted user returns 404 on GET /:id', async () => {
      const res = await request(app)
        .get(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('soft-deleted user does not appear in GET / list', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ id: string }>).map((u) => u.id);
      expect(ids).not.toContain(targetUserId);
    });

    it('soft-deleted user cannot log in → 401 (user not found)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: targetUserEmail, password: TEST_PASSWORD });

      // Email was mangled during soft-delete, so user lookup fails → 401
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('deleting an already-deleted user → 404', async () => {
      const res = await request(app)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('delete non-existent UUID → 404', async () => {
      const res = await request(app)
        .delete('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('delete with invalid UUID format → 400', async () => {
      const res = await request(app)
        .delete('/api/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated delete → 401', async () => {
      const res = await request(app).delete(`/api/users/${viewerId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
