/**
 * Load extracted homepage sliders into bigbike-backend through the admin API.
 *
 * Required input:
 *   scripts/extract-wp-data/output/sliders.json
 *
 * Auth:
 *   Set BIGBIKE_ADMIN_TOKEN, or set BIGBIKE_ADMIN_EMAIL + BIGBIKE_ADMIN_PASSWORD
 *   so this script can call POST /api/v1/auth/login.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const OUT_DIR = join(__dirname, "output");
const API_BASE = process.env.BIGBIKE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

type ExtractedImage = {
  url: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
};

type ExtractedSlider = {
  index: number;
  sortOrder?: number;
  location?: string;
  productPostId: number | null;
  link: string | null;
  desktopImage: ExtractedImage | null;
  mobileImage: ExtractedImage | null;
  finalLink: string | null;
};

type StepError = {
  sortOrder: number;
  status?: number;
  message: string;
};

async function main() {
  const sliders = readJson<ExtractedSlider[]>("sliders.json");
  const token = await resolveAdminToken();
  const errors: StepError[] = [];
  let loadedCount = 0;

  for (const slider of sliders) {
    const sortOrder = slider.sortOrder ?? slider.index;
    const productId = slider.productPostId ? `wp-prod-${slider.productPostId}` : null;
    const externalLink = productId ? null : slider.finalLink || slider.link;

    const payload = {
      location: slider.location || "home",
      sortOrder,
      desktopImage: toAdminImage(slider.desktopImage),
      mobileImage: slider.mobileImage ? toAdminImage(slider.mobileImage) : null,
      productId,
      externalLink,
    };

    const response = await fetch(`${API_BASE}/api/v1/admin/sliders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      errors.push({
        sortOrder,
        status: response.status,
        message: await response.text(),
      });
      continue;
    }

    loadedCount += 1;
  }

  const report = {
    sourceCount: sliders.length,
    loadedCount,
    errors,
  };
  writeFileSync(join(OUT_DIR, "load-sliders-report.json"), JSON.stringify(report, null, 2), "utf8");

  if (errors.length > 0) {
    throw new Error(`Slider load finished with ${errors.length} error(s). See output/load-sliders-report.json.`);
  }

  console.log(`Loaded ${loadedCount} sliders into ${API_BASE}.`);
}

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(OUT_DIR, filename), "utf8")) as T;
}

function toAdminImage(image: ExtractedImage | null) {
  return {
    url: image?.url ?? null,
    alt: image?.alt ?? null,
    width: image?.width ?? null,
    height: image?.height ?? null,
    mimeType: image?.url ? guessMimeType(image.url) : null,
  };
}

function guessMimeType(url: string) {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function resolveAdminToken() {
  if (process.env.BIGBIKE_ADMIN_TOKEN?.trim()) {
    return process.env.BIGBIKE_ADMIN_TOKEN.trim();
  }

  const email = process.env.BIGBIKE_ADMIN_EMAIL;
  const password = process.env.BIGBIKE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set BIGBIKE_ADMIN_TOKEN or BIGBIKE_ADMIN_EMAIL + BIGBIKE_ADMIN_PASSWORD.");
  }

  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Admin login failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { data?: { accessToken?: string } };
  if (!body.data?.accessToken) {
    throw new Error("Admin login response did not include data.accessToken.");
  }
  return body.data.accessToken;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
