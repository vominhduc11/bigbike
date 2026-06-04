// Item 18 (🔴) — Admin auth + backend permission enforcement.
// Oracle: docs/engineering/PERMISSION_MATRIX.md — all /api/v1/admin/** require
//   isAuthenticated() && !hasRole('CUSTOMER'); fine-grained requirePermission() per endpoint.
//   DevAdminAuthService dev-header bypass is gated (bigbike.auth.dev-header-enabled=false in
//   the running dev stack) and throws under prod profile.
import { req, test, expect, adminLogin, createCustomerSession, suite } from './lib/harness.mjs';

const ADMIN_READ = [
  '/api/v1/admin/orders',
  '/api/v1/admin/products',
  '/api/v1/admin/customers',
  '/api/v1/admin/inventory',
  '/api/v1/admin/roles',
  '/api/v1/admin/audit-logs',
];

export default async function run() {
  suite('Item 18 — Admin auth & permission (PERMISSION_MATRIX.md)');

  // 1) Real admin login works (NOT dev/mock auth) and returns a usable JWT.
  let admin;
  await test('18', 'Real admin login (admin@bigbike.vn) returns JWT + role + permissions', async () => {
    admin = await adminLogin();
    expect(admin.user.role).toBe('SUPER_ADMIN');
    expect(admin.user.permissions.includes('*')).toBeTruthy('SUPER_ADMIN should have wildcard *');
    expect(admin.token.length).toBeGreaterThan(20);
  });

  // 2) Admin token actually authorizes admin reads.
  await test('18', 'Admin JWT authorizes GET /admin/orders (200)', async () => {
    if (!admin) throw new Error('no admin token');
    const r = await req('GET', '/api/v1/admin/orders', { token: admin.token });
    expect(r.status).toBe(200, `expected 200, got ${r.status} ${r.text?.slice(0, 150)}`);
  });

  // 3) GUEST (no auth) -> admin reads must be 401 (backend gate, not UI).
  for (const path of ADMIN_READ) {
    await test('18', `Guest -> GET ${path} rejected (401)`, async () => {
      const r = await req('GET', path);
      expect(r.status).toBe(401, `expected 401, got ${r.status}`);
    });
  }

  // 4) GUEST -> admin WRITE must be rejected (401), proving writes are gated too.
  await test('18', 'Guest -> POST /admin/products rejected (401)', async () => {
    const r = await req('POST', '/api/v1/admin/products', { body: { name: 'qa' } });
    expect(r.status).toBeOneOf([401], `expected 401, got ${r.status}`);
  });
  await test('18', 'Guest -> PATCH /admin/orders/{id}/status rejected (401)', async () => {
    const r = await req('PATCH', '/api/v1/admin/orders/00000000-0000-0000-0000-000000000000/status', { body: { status: 'COMPLETED' } });
    expect(r.status).toBe(401, `expected 401, got ${r.status}`);
  });

  // 5) DEV-HEADER BYPASS MUST BE OFF on the running dev stack: forging X-Admin-Role
  //    headers as a guest must NOT grant access (else dev auth is dangerously enabled).
  await test('18', 'Forged X-Admin-Role headers do NOT bypass auth (dev-header disabled)', async () => {
    const r = await req('GET', '/api/v1/admin/orders', {
      headers: { 'X-Admin-Role': 'SUPER_ADMIN', 'X-Admin-Permissions': '*' },
    });
    expect(r.status).toBeOneOf([401, 403], `dev-header bypass appears ENABLED — got ${r.status} (expected 401/403)`);
  });

  // 6) AUTHENTICATED CUSTOMER -> admin endpoints must be 403 (authn ok, authz denied).
  const cust = await createCustomerSession();
  await test('18', 'Customer session is valid for its own resource (/customer/me 200)', async () => {
    const r = await req('GET', '/api/v1/customer/me', { cookies: cust.cookies });
    expect(r.status).toBe(200, `customer session broken: ${r.status}`);
  });
  for (const path of ['/api/v1/admin/orders', '/api/v1/admin/products', '/api/v1/admin/customers', '/api/v1/admin/inventory']) {
    await test('18', `Customer -> GET ${path} forbidden (403)`, async () => {
      const r = await req('GET', path, { cookies: cust.cookies });
      expect(r.status).toBe(403, `expected 403, got ${r.status}`);
    });
  }
  await test('18', 'Customer -> POST /admin/products forbidden (403)', async () => {
    const r = await req('POST', '/api/v1/admin/products', { cookies: cust.cookies, body: { name: 'qa' } });
    expect(r.status).toBe(403, `expected 403, got ${r.status}`);
  });
}
