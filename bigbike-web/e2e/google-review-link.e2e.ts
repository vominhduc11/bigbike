import { expect, test } from "@playwright/test";
import { GOOGLE_REVIEW_URL } from "../lib/review-link";
import { VIEWPORTS } from "./helpers/viewports";

const QUERY = "?utm_source=qr&utm_medium=offline&utm_campaign=qr-danh-gia";
const ROUTES = ["/danh-gia/", "/review/", "/en/review/"];
const GA_COLLECT = /^https:\/\/[^/]*(?:google-analytics\.com|analytics\.google\.com)\//;

test.describe("Google review invitation bridge", () => {
  for (const path of ROUTES) {
    test(`server HTML, robots, language, CSP and slash normalization: ${path}`, async ({
      request,
    }) => {
      const response = await request.get(path + QUERY);
      expect(response.status()).toBe(200);
      expect(new URL(response.url()).pathname).toBe(path);
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      const html = await response.text();
      expect(html).toContain(`href="${GOOGLE_REVIEW_URL}"`);
      expect(html).toMatch(/<noscript><meta[^>]*http-equiv="refresh"[^>]*content="2;url=/);
      expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect(html).toContain(`<html lang="${path === "/danh-gia/" ? "vi" : "en"}"`);
      expect(html).toContain(
        path === "/danh-gia/" ? "Đang chuyển đến Google" : "Redirecting to Google",
      );
      const csp = response.headers()["content-security-policy"];
      expect(
        csp
          .split(";")
          .find((value) => value.trim().startsWith("form-action"))
          ?.trim(),
      ).toBe("form-action 'self' https://www.facebook.com");
      expect(csp).toContain("https://static.cloudflareinsights.com");
      expect(csp).not.toContain("*.facebook.com");
      const slashless = await request.get(path.slice(0, -1) + QUERY, { maxRedirects: 0 });
      expect(slashless.status()).toBe(308);
      const target = new URL(slashless.headers().location, slashless.url());
      expect(target.pathname + target.search).toBe(path + QUERY);
    });
  }

  for (const mode of ["callback", "blocked", "no-callback"] as const) {
    test(`browser navigation once with ${mode}, fresh opening counts again`, async ({
      page,
      context,
    }) => {
      const events: Record<string, unknown>[] = [];
      let arrivals = 0;
      await context.exposeFunction("__reviewObserved", (event: Record<string, unknown>) =>
        events.push(event),
      );
      await context.route(GA_COLLECT, (route) => route.fulfill({ status: 204 }));
      await context.route("https://www.googletagmanager.com/gtag/js**", (route) => {
        if (mode === "blocked") return route.abort();
        return route.fulfill({
          contentType: "application/javascript",
          body: `
          window.gtag = function(command, name, params) {
            if (command !== 'event' || name !== 'review_link_open') return;
            window.__reviewObserved({name, page_location: params.page_location, transport_type: params.transport_type, event_timeout: params.event_timeout});
            if (${JSON.stringify(mode)} === 'callback') setTimeout(function(){params.event_callback(); params.event_callback();}, 40);
          };
          (window.dataLayer || []).forEach(function(args) { window.gtag.apply(null, args); });
        `,
        });
      });
      await context.route(GOOGLE_REVIEW_URL, (route) => {
        arrivals++;
        return route.fulfill({
          contentType: "text/html",
          body: "<title>Google destination intercepted</title>",
        });
      });
      for (let opening = 1; opening <= 2; opening++) {
        const response = await page.goto("/review/" + QUERY);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(GOOGLE_REVIEW_URL);
        expect(arrivals).toBe(opening);
        expect(events).toHaveLength(mode === "blocked" ? 0 : opening);
      }
      if (mode !== "blocked") {
        expect(events[0]).toMatchObject({ name: "review_link_open", transport_type: "beacon" });
        expect(new URL(events[0].page_location as string).search).toBe(QUERY);
        expect(events[0].event_timeout).toBeLessThan(800);
      }
    });
  }

  test("actual CSP permits Meta form transport and loading the retained Cloudflare script", async ({
    page,
    context,
    request,
  }) => {
    const response = await request.get("/review/");
    const csp = response.headers()["content-security-policy"];
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });
    await context.route("**/__review_csp_probe/", (route) =>
      route.fulfill({
        contentType: "text/html",
        headers: { "content-security-policy": csp },
        body: `<script src="https://static.cloudflareinsights.com/beacon.min.js"></script><form action="https://www.facebook.com/tr/" method="post"><input name="dev56_probe" value="1"></form>`,
      }),
    );
    // Real script request, but prevent reporting: no Cloudflare site token is supplied.
    const cloudflare = page.waitForResponse((response) =>
      response.url().startsWith("https://static.cloudflareinsights.com/beacon.min.js"),
    );
    await page.goto("/__review_csp_probe/");
    expect((await cloudflare).status()).toBe(200);
    await context.route("https://www.facebook.com/tr/", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>Meta form intercepted</title>" }),
    );
    await page.evaluate(() => document.querySelector("form")!.submit());
    await expect(page).toHaveURL("https://www.facebook.com/tr/");
    expect(violations).toEqual([]);
  });

  test("JavaScript off: server link and two-second refresh both work", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    let arrivals = 0;
    await context.route(GOOGLE_REVIEW_URL, (route) => {
      arrivals++;
      return route.fulfill({
        contentType: "text/html",
        body: "<title>Google destination intercepted</title>",
      });
    });
    try {
      const page = await context.newPage();
      await page.goto("/danh-gia/" + QUERY);
      await expect(page.getByRole("link", { name: "Tiếp tục đến Google" })).toHaveAttribute(
        "href",
        GOOGLE_REVIEW_URL,
      );
      await expect(page).toHaveURL(GOOGLE_REVIEW_URL);
      expect(arrivals).toBe(1);
      await page.goto("/review/");
      await page.getByRole("link", { name: "Continue to Google" }).click();
      await expect(page).toHaveURL(GOOGLE_REVIEW_URL);
      expect(arrivals).toBe(2);
    } finally {
      await context.close();
    }
  });

  test("real sitemap and robots keep the invitation crawlable but unlisted", async ({
    request,
  }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    for (const path of ROUTES) expect(xml).not.toContain(`${path}</loc>`);
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const disallows = (await robots.text())
      .split("\n")
      .filter((line) => line.startsWith("Disallow:"));
    expect(disallows.some((line) => /danh-gia|review/.test(line))).toBe(false);
  });

  for (const viewport of VIEWPORTS.filter((viewport) =>
    ["mobile-375x812", "tablet-768x1024", "desktop-1440x900"].includes(viewport.name),
  )) {
    test(`manual fallback is readable at ${viewport.name}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport });
      try {
        const page = await context.newPage();
        await page.goto("/review/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const link = page.getByRole("link", { name: "Continue to Google" });
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      } finally {
        await context.close();
      }
    });
  }

  test("real Google tag assembles review event with original UTM (collection intercepted)", async ({
    page,
    context,
  }, testInfo) => {
    const payloads: { url: string; method: string; resourceType: string; body: string | null }[] =
      [];
    await context.route(GA_COLLECT, (route) => {
      const request = route.request();
      payloads.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        body: request.postData(),
      });
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    });
    await context.route(GOOGLE_REVIEW_URL, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Google destination intercepted</title>",
      }),
    );
    // Download the real tag once and serve those bytes as a warm-cache equivalent. This isolates
    // actual event assembly/transport from download latency. All GA4 collection is intercepted.
    const id = process.env.PW_GA4_MEASUREMENT_ID;
    test.skip(
      !id,
      "Set PW_GA4_MEASUREMENT_ID to the isolated build's test id for real tag wire verification",
    );
    const tag = await context.request.get(`https://www.googletagmanager.com/gtag/js?id=${id}`);
    expect(tag.status()).toBe(200);
    const tagBody = await tag.text();
    await context.route("https://www.googletagmanager.com/gtag/js**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: tagBody }),
    );
    await page.goto("/danh-gia/" + QUERY);
    await expect(page).toHaveURL(GOOGLE_REVIEW_URL);
    await expect
      .poll(
        () =>
          payloads.filter((value) => `${value.url}&${value.body}`.includes("en=review_link_open"))
            .length,
      )
      .toBe(1);
    const event = payloads.find((value) =>
      `${value.url}&${value.body}`.includes("en=review_link_open"),
    )!;
    const parameters = new URLSearchParams(new URL(event.url).search + "&" + (event.body ?? ""));
    expect(parameters.get("tid")).toBe(id);
    expect(parameters.get("ep.transport_type")).toBe("beacon");
    expect(new URL(parameters.get("dl")!).pathname).toBe("/danh-gia/");
    expect(new URL(parameters.get("dl")!).search).toBe(QUERY);
    await testInfo.attach("actual-google-tag-collect.json", {
      body: JSON.stringify(
        payloads.map((payload) => {
          const url = new URL(payload.url);
          const params = new URLSearchParams(url.search + "&" + (payload.body ?? ""));
          return {
            endpoint: url.origin + url.pathname,
            method: payload.method,
            resourceType: payload.resourceType,
            parameters: Object.fromEntries(
              ["tid", "en", "dl", "ep.transport_type"].map((key) => [key, params.get(key)]),
            ),
            collection: "intercepted before delivery; not account receipt",
          };
        }),
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
});
