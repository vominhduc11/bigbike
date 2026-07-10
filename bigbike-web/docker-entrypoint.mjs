// Container entrypoint for the standalone Next.js server.
//
// Starts `server.js`, then — once the server answers — expires the storefront
// ISR cache tags. `next build` bakes a data snapshot into the prerendered
// pages; without this a freshly built/started container serves that stale
// snapshot until the 1h ISR window elapses or an admin mutation triggers a
// revalidate (WebRevalidationService). Firing it on startup makes every
// container start self-heal — including partial `docker compose up --no-deps`
// rebuilds that the external init container is skipped for.
//
// Uses Node's global fetch for the POST: BusyBox wget on alpine cannot reliably
// POST, which is why the legacy init container needed a separate curl image.
import { spawn } from "node:child_process";

const PORT = process.env.PORT || "3000";
// Match the auth the revalidate route checks: env.REVALIDATE_SECRET ?? env.WEB_REVALIDATE_SECRET.
// In compose the web container receives the secret as REVALIDATE_SECRET (WEB_REVALIDATE_SECRET
// is the backend's copy), so prefer that name.
const SECRET = process.env.REVALIDATE_SECRET || process.env.WEB_REVALIDATE_SECRET;
const BASE = `http://127.0.0.1:${PORT}`;
// Entity tags cover the storefront lists AND the catalog facets sidebar — the
// facets endpoint is cached under ["products","categories","brands"], so
// expiring those refreshes the brand/colour/gender/price filter counts too.
const TAGS = [
  "products", "categories", "brands", "articles", "settings",
  "menus", "home-videos", "home-highlights", "sliders",
];

const server = spawn("node", ["server.js"], { stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.kill(sig));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function revalidateOnStartup() {
  if (!SECRET) {
    console.log("[entrypoint] WEB_REVALIDATE_SECRET unset — skipping startup revalidate");
    return;
  }
  // Wait (max ~60s) until the server accepts requests before revalidating.
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(BASE, { method: "GET" });
      if (res.status < 500) break;
    } catch {
      // server not listening yet
    }
    await sleep(1000);
  }
  try {
    const res = await fetch(`${BASE}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": SECRET },
      body: JSON.stringify({ tags: TAGS }),
    });
    console.log(`[entrypoint] startup revalidate → HTTP ${res.status}`);
  } catch (err) {
    console.log(`[entrypoint] startup revalidate failed (non-fatal): ${err}`);
  }
}

revalidateOnStartup();
