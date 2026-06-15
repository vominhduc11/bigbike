---
name: run-bigbike-admin
description: Run, launch, build, screenshot, or drive the bigbike-admin dashboard (Vite + React SPA). Use when asked to start the admin app, take a screenshot of an admin screen, verify an admin change in the real running app, or drive an admin route end-to-end with login. Drives the live Docker container on :4000 via a Playwright driver.
---

# Run bigbike-admin

`bigbike-admin` is the internal admin dashboard — a Vite + React SPA, served in
production by nginx inside the `bigbike-admin` Docker container on
**http://localhost:4000**. It talks to the Spring backend (`/api/v1`, proxied to
`bigbike-backend` on :8080) and MinIO for media.

You don't run this app by hand to test a change — you **drive it with the
committed Playwright driver**, which logs in as SUPER_ADMIN, navigates a route,
screenshots it, and reports console / page / API errors. The driver is the
primary path; everything below is in service of it.

> **Paths below are relative to `bigbike-admin/`** (the unit dir). The driver
> lives at `.claude/skills/run-bigbike-admin/driver.mjs`.
>
> **Shell: use PowerShell.** Git Bash mangles route args that start with `/`
> (MSYS path conversion turns `/admin/dashboard` into a Windows path). Every
> command here was run in PowerShell.

## Prerequisites — the stack must already be up

The driver targets the **running container**, it does not start one. Confirm the
stack is healthy first (run from the repo root `s:\project\bigbike`):

```powershell
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

You want `bigbike-admin` (→:4000), `bigbike-backend` (→:8080) and
`bigbike-postgres` all `Up ... (healthy)`. If `bigbike-admin` is **not** running,
**ask the user to start it** — do not `up`/`restart` the shared stack yourself:

```
docker compose up -d bigbike-admin bigbike-backend
```

No `apt-get` / npm install is needed to *drive* the app: Playwright and its
chromium are already in `bigbike-admin/node_modules` (and the OS Playwright
cache). The driver resolves `playwright` from there.

## Run (agent path) — the driver

From `bigbike-admin/`, in **PowerShell**. The driver takes a route and writes a
full-page screenshot to `.claude/skills/run-bigbike-admin/shots/<slug>.png`,
then prints a JSON report.

```powershell
node .claude\skills\run-bigbike-admin\driver.mjs /admin/dashboard
```

Other screens — same pattern, any in-app route:

```powershell
node .claude\skills\run-bigbike-admin\driver.mjs /admin/products
```

A detail screen needs a real id (products use string ids like `wp-prod-41359`):

```powershell
node .claude\skills\run-bigbike-admin\driver.mjs /admin/products/wp-prod-41359
```

The JSON report looks like this (exit 0 = clean, exit 1 = console/page errors):

```json
{
  "route": "/admin/products/wp-prod-41359",
  "url": "http://localhost:4000/admin/products/wp-prod-41359",
  "title": "bigbike-admin",
  "screenshot": "...\\shots\\admin-products-wp-prod-41359.png",
  "consoleErrors": [], "pageErrors": [], "apiErrors": [],
  "clean": true
}
```

**Then open the screenshot and look at it.** A clean report only means no JS/API
errors — it does not prove the screen rendered what you expect. Read the PNG.

### What the driver handles for you

- **Login** — API-logs-in as `admin@bigbike.vn` / `admin123` (SUPER_ADMIN,
  permissions `["*"]`, every route reachable), gets the `bb_admin_refresh`
  cookie, injects it. The SPA boots already authenticated — no form typing.
- **Single-use cookie** — the refresh cookie is rotated/revoked on use. If a run
  lands on the login shell, the driver re-logs-in and reloads once.
- **Override target / creds** via env: `ADMIN_BASE`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`. `HEADED=1` shows a window. Defaults target
  `http://localhost:4000` — keep `localhost`, see the CORS gotcha below.

To find a valid product id for a detail route, query the API (note: paging is
**1-based** — `page=0` returns a validation error):

```powershell
curl.exe -s "http://localhost:4000/api/v1/products?page=1&size=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d.replace(/^﻿/,'')).data;console.log(a[0].id,'|',a[0].name)})"
```

(The `replace(/^﻿/,'')` strips the UTF-8 BOM PowerShell prepends when piping
`curl.exe` into `node`; without it `JSON.parse` throws `Unexpected token '﻿'`.)

## Test — the existing e2e suite, against the live container

The admin ships a full Playwright e2e/UI-quality suite under `e2e/`. By default
it builds its own preview on :4280; point it at the live container instead with
`E2E_BASE_URL` + `E2E_NO_WEBSERVER`. Run a single spec (the suite is serial and
login is rate-limited 5/min/IP — don't blast the whole thing repeatedly):

```powershell
$env:E2E_BASE_URL="http://localhost:4000"; $env:E2E_NO_WEBSERVER="1"; npx playwright test effects.spec.ts -g "theme toggle"
```

List everything available without running it:

```powershell
npx playwright test --list
```

Unit tests (Vitest) are separate: `npm test`.

## Run (human path)

`npm run dev` starts the Vite dev server — but it **binds the same port 4000**
the prod container holds, so it will conflict unless you stop the container
first. The dev server proxies `/api`→:8080 and `/media`→MinIO. This is the path
for live source iteration; it is not needed to drive the already-built
container, and a bare `npm run dev` opens nothing you can click headless. Prefer
the driver.

## Gotchas

- **PowerShell only for the driver.** In Git Bash, `node driver.mjs /admin/x`
  becomes `c:/Program Files/Git/admin/x` (MSYS path conversion) and Playwright
  fails with `net::ERR_FILE_NOT_FOUND`. Use PowerShell, or prefix
  `MSYS_NO_PATHCONV=1` in bash.
- **Use `localhost`, NOT `127.0.0.1`, for the base URL.** The backend's
  CORS/origin allowlist accepts `http://localhost:4000` only. Pointing
  `ADMIN_BASE` at `http://127.0.0.1:4000` connects fine but the SPA's
  `/api/v1/auth/refresh` is rejected `403`, the app never leaves the login shell,
  and the driver prints `WARNING: .bb-app shell never attached`. The default is
  already `localhost`; don't "fix" it to an IP.
- **Dev server and prod container both want :4000.** Can't run both. The driver
  defaults to the container; if you start `npm run dev`, stop the container or
  the bind fails.
- **Products paging is 1-based.** `?page=0` → `VALIDATION_ERROR`. Start at
  `page=1`.
- **Login is 5/min/IP, refresh 30/min, access token in-memory.** The driver
  logs in fresh each run; running it in a tight loop will eventually 429 (it
  backs off and retries up to 6×). The e2e suite runs `workers: 1` for the same
  reason — don't bump parallelism.
- **The refresh cookie is single-use** (`Path=/api/v1/auth`, rotated on every
  refresh). Don't try to reuse a captured cookie across processes; just
  re-login.
- **Full-page screenshots of edit forms are very tall** (the product detail
  screen is one long form). Expect a narrow, long PNG — that's correct, not a
  layout bug.

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| `net::ERR_FILE_NOT_FOUND at c:/Program Files/Git/...` | Ran in Git Bash; the `/route` arg was path-mangled. Use PowerShell. |
| `[login] ECONNREFUSED ::1:4000` or curl `-> 000` | Container is down or mid-restart. `docker ps --filter name=bigbike-admin` — if `Up N seconds`, it just bounced; wait and re-run. If absent, ask user to `up -d bigbike-admin bigbike-backend`. |
| `/api/v1/auth/refresh -> 403` + `shell never attached` | `ADMIN_BASE` points at `127.0.0.1` (or another host) not on the CORS allowlist. Use `http://localhost:4000`. |
| `[login] 401` | Wrong creds, or backend has no SUPER_ADMIN seed. Default is `admin@bigbike.vn`/`admin123`. |
| `[login] 429` repeatedly | Hit the 5/min login limit. Wait ~60s; the driver already backs off. |
| Report `clean:true` but screenshot is the login shell | Cookie rotation race — re-run once (the driver self-heals, but a cold run may need a retry). |
| `Cannot find package 'playwright'` | Run from inside `bigbike-admin/` so node resolves its `node_modules`. |
