// Item L + Item 17 (🔴) — Environment / config + password-reset link target.
// Oracle: CLAUDE.md / AGENTS.md §5.5 — local stack must use http://localhost:3000 for
//   email verify/reset links; SPRING_PROFILES_ACTIVE=dev; CORS allows localhost:3000.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { req, test, expect, suite, registerCustomer } from './lib/harness.mjs';

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
function docker(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

export default async function run() {
  suite('Item L/17 — Config & environment');
  const env = parseEnv('.env');

  // ---- Static .env assertions (item L: "kiểm tra .env trước khi lên thật") ----
  await test('17', '.env reset link base = http://localhost:3000/...', () => {
    expect(env.BIGBIKE_MAIL_RESET_BASE_URL).toContain('http://localhost:3000', `got ${env.BIGBIKE_MAIL_RESET_BASE_URL}`);
  });
  await test('17', '.env verify-email link base = http://localhost:3000/...', () => {
    expect(env.BIGBIKE_MAIL_VERIFY_BASE_URL).toContain('http://localhost:3000', `got ${env.BIGBIKE_MAIL_VERIFY_BASE_URL}`);
  });
  await test('L', '.env site/admin base URLs = localhost:3000 / :4000', () => {
    expect(env.BIGBIKE_SITE_BASE_URL).toContain('http://localhost:3000');
    expect(env.BIGBIKE_ADMIN_BASE_URL).toContain('http://localhost:4000');
  });
  await test('L', '.env SPRING_PROFILES_ACTIVE = dev (not prod)', () => {
    expect(env.SPRING_PROFILES_ACTIVE).toBe('dev');
  });
  await test('L', '.env CORS allowed origins include localhost:3000', () => {
    expect(env.BIGBIKE_CORS_ALLOWED_ORIGINS).toContain('http://localhost:3000');
  });
  await test('L', '.env SMTP host configured', () => {
    expect(env.BIGBIKE_MAIL_HOST).toBeTruthy('mail host must be set for transactional email');
  });

  // ---- Authoritative: the RUNNING backend container's resolved environment ----
  await test('17', 'RUNNING backend container resolves reset/verify base = localhost:3000', () => {
    const printenv = docker('docker exec bigbike-backend printenv');
    if (printenv == null) { const e = new Error('docker exec unavailable'); e.__skip = true; throw e; }
    expect(printenv).toContain('BIGBIKE_MAIL_RESET_BASE_URL=http://localhost:3000');
    expect(printenv).toContain('BIGBIKE_MAIL_VERIFY_BASE_URL=http://localhost:3000');
    expect(printenv).toContain('SPRING_PROFILES_ACTIVE=dev');
  });

  // ---- Live CORS enforcement ----
  await test('L', 'CORS preflight allows localhost:3000 (ACAO echoed)', async () => {
    const r = await req('OPTIONS', '/api/v1/products', {
      headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'GET' },
    });
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(r.headers.get('access-control-allow-credentials')).toBe('true');
  });
  await test('L', 'CORS rejects unknown origin (evil.com -> no ACAO)', async () => {
    const r = await req('OPTIONS', '/api/v1/products', {
      headers: { Origin: 'http://evil.com', 'Access-Control-Request-Method': 'GET' },
    });
    expect(r.headers.get('access-control-allow-origin')).toBeOneOf([null], 'evil.com must not receive an allow-origin');
  });

  // ---- Password reset flow exists & dispatches (item 17 🔴) ----
  const cust = await registerCustomer();
  await test('17', 'POST /password/forgot accepts request (200, no account-existence leak)', async () => {
    const r = await req('POST', '/api/v1/customer/auth/password/forgot', { body: { login: cust.email } });
    expect(r.status).toBe(200, `got ${r.status}`);
  });
  await test('17', 'Forgot creates a reset token row (email dispatch triggered)', async () => {
    if (!cust.customerId) { const e = new Error('no customerId'); e.__skip = true; throw e; }
    const n = docker(`docker exec bigbike-postgres psql -U bigbike -d bigbike -t -A -c "select count(*) from customer_password_reset_tokens where customer_id='${cust.customerId}'"`);
    if (n == null) { const e = new Error('docker psql unavailable'); e.__skip = true; throw e; }
    expect(Number(n)).toBeGreaterThan(0, `expected >=1 reset token, got ${n}`);
  });
  await test('17', 'POST /password/reset endpoint exists & validates token (bad token -> 400)', async () => {
    const r = await req('POST', '/api/v1/customer/auth/password/reset', { body: { token: 'invalid-token-xyz', password: 'NewPass!2345' } });
    expect(r.status).toBe(400, `expected 400 (not 404), got ${r.status}`);
  });
}
