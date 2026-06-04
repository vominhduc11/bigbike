// BigBike QA — live black-box harness (no external deps, Node 18+ global fetch).
// Tests run against the RUNNING docker stack. Source of truth = docs/ (cited per test).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const BACKEND = process.env.BACKEND_BASE || 'http://localhost:8080';
export const API = `${BACKEND}/api/v1`;

// ---- HTTP ----
export async function req(method, path, { token, body, cookies, headers } = {}) {
  const url = path.startsWith('http') ? path : `${BACKEND}${path}`;
  const h = { ...(headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (cookies) h['Cookie'] = cookies;
  const res = await fetch(url, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { /* non-json */ }
  // collect set-cookie (Node fetch: getSetCookie)
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, json, text, headers: res.headers, setCookie };
}

export function cookieHeaderFrom(setCookie) {
  return (setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

// ---- Assertions (throw on failure) ----
export function expect(actual) {
  return {
    toBe(exp, msg) { if (actual !== exp) throw new Error(msg || `expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`); },
    toBeOneOf(arr, msg) { if (!arr.includes(actual)) throw new Error(msg || `expected one of ${JSON.stringify(arr)}, got ${JSON.stringify(actual)}`); },
    toContain(sub, msg) { if (actual == null || !String(actual).includes(sub)) throw new Error(msg || `expected "${actual}" to contain "${sub}"`); },
    toBeTruthy(msg) { if (!actual) throw new Error(msg || `expected truthy, got ${JSON.stringify(actual)}`); },
    toBeGreaterThan(n, msg) { if (!(actual > n)) throw new Error(msg || `expected > ${n}, got ${actual}`); },
  };
}

// ---- Test recorder ----
const results = [];
let _suite = '';
export function suite(name) { _suite = name; }

export async function test(item, name, fn) {
  const rec = { suite: _suite, item, name, status: 'PASS', error: null, ms: 0 };
  const t0 = Date.now();
  try {
    await fn();
  } catch (e) {
    rec.status = (e && e.__skip) ? 'SKIPPED' : (e && e.__blocked) ? 'BLOCKED' : 'FAIL';
    rec.error = e && e.message ? e.message : String(e);
  }
  rec.ms = Date.now() - t0;
  results.push(rec);
  const icon = { PASS: 'PASS', FAIL: 'FAIL', SKIPPED: 'SKIP', BLOCKED: 'BLOK' }[rec.status];
  console.log(`  [${icon}] (${item}) ${name}${rec.error ? ' — ' + rec.error : ''}`);
  return rec;
}

export function skip(msg) { const e = new Error(msg); e.__skip = true; throw e; }
export function blocked(msg) { const e = new Error(msg); e.__blocked = true; throw e; }

export function getResults() { return results; }

export function writeReport(path) {
  mkdirSync(dirname(path), { recursive: true });
  const summary = results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2), 'utf8');
  console.log(`\n=== SUMMARY ${JSON.stringify(summary)} ===`);
  console.log(`report -> ${path}`);
  return summary;
}

// ---- Shared logins ----
export async function adminLogin(email = 'admin@bigbike.vn', password = process.env.ADMIN_PASSWORD || 'admin123') {
  const r = await req('POST', '/api/v1/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.json?.data?.accessToken) {
    throw new Error(`admin login failed: HTTP ${r.status} ${r.text?.slice(0, 200)}`);
  }
  return { token: r.json.data.accessToken, user: r.json.data.user, raw: r };
}

// Customer auth is SESSION-COOKIE based: cookies bb_session / bb_refresh / bb_csrf,
// plus a csrfToken in the body (double-submit). No bearer token is issued.
let _custSeq = 0;
export async function registerCustomer() {
  const n = Date.now();
  const seq = _custSeq++;
  const email = `qa_${n}_${seq}@bigbike.test`;
  // phone must match ^0[3-9]\d{8}$ — build from pure digits only.
  const phone = '03' + String(n).slice(-7) + String(seq % 10);
  const password = 'QaPass!2345';
  const r = await req('POST', '/api/v1/customer/auth/register', {
    body: { email, phone, password, displayName: 'QA Tester' },
  });
  return {
    email, phone, password, res: r,
    cookies: cookieHeaderFrom(r.setCookie),
    csrfToken: r.json?.data?.csrfToken,
    customerId: r.json?.data?.customer?.id,
  };
}

export async function customerLogin(login, password, remember = true) {
  const r = await req('POST', '/api/v1/customer/auth/login', { body: { login, password, remember } });
  return {
    res: r,
    cookies: cookieHeaderFrom(r.setCookie),
    csrfToken: r.json?.data?.csrfToken,
    customerId: r.json?.data?.customer?.id,
  };
}

// Register a fresh customer then log in, returning an authenticated session
// (login cookies are the ones that satisfy /customer/me).
export async function createCustomerSession() {
  const c = await registerCustomer();
  const s = await customerLogin(c.email, c.password, true);
  return { email: c.email, phone: c.phone, password: c.password, customerId: c.customerId, cookies: s.cookies, csrfToken: s.csrfToken };
}
