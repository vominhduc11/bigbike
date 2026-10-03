import type { Page } from "@playwright/test";

const PREVIEW_ORIGIN = new URL(process.env.PW_BASE_URL || "http://localhost:3000").origin;
const LOCAL_BACKEND_ORIGIN = "http://localhost:8080";

/**
 * A production preview commonly runs on an isolated port while the shared backend accepts only
 * the normal storefront origin. Keep every real backend request/response, changing CORS headers
 * only inside this browser so preview E2E does not report an artificial cross-origin failure.
 */
export async function installPreviewBackendCors(page: Page, backendOrigin = LOCAL_BACKEND_ORIGIN) {
  await page.route(`${backendOrigin}/**`, async (route) => {
    const request = route.request();
    const corsHeaders = {
      "access-control-allow-origin": PREVIEW_ORIGIN,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods":
        request.headers()["access-control-request-method"] || "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers":
        request.headers()["access-control-request-headers"] || "Content-Type, X-Visitor-Id",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const response = await route.fetch({
      headers: { ...request.headers(), origin: "https://bigbike.vn" },
    });
    await route.fulfill({ response, headers: { ...response.headers(), ...corsHeaders } });
  });
}

/**
 * The shared Docker backend deliberately issues production cookies for `.bigbike.vn` with
 * `Secure`. An isolated HTTP preview cannot retain those cookies, so browser-only checkout E2E
 * mirrors the freshly issued anonymous guest/CSRF pair onto localhost. Values are never logged
 * or persisted, and the caller removes its temporary cart before the context closes.
 */
export async function bootstrapPreviewCustomerSession(page: Page) {
  const response = await page.request.get(`${LOCAL_BACKEND_ORIGIN}/api/v1/cart`, {
    headers: { Origin: "https://bigbike.vn" },
  });
  if (!response.ok()) {
    throw new Error(`Không khởi tạo được phiên giỏ E2E (${response.status()}).`);
  }

  const cookies = response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value.split(";", 1)[0])
    .map((pair) => {
      const separator = pair.indexOf("=");
      return separator > 0
        ? { name: pair.slice(0, separator), value: pair.slice(separator + 1) }
        : null;
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie));

  if (!cookies.some(({ name }) => name === "bb_csrf")) {
    throw new Error("Backend không cấp cookie CSRF cho phiên giỏ E2E.");
  }

  await page.context().addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      url: PREVIEW_ORIGIN,
      httpOnly: name !== "bb_csrf",
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}
