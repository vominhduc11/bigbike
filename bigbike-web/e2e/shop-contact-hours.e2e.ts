import { expect, test } from "@playwright/test";
import { DESKTOP, MOBILE } from "./helpers/viewports";
import {
  expectNoHorizontalOverflow,
  installPageGuards,
  summarizeGuards,
} from "./helpers/ui-quality";
import { getStoreHours } from "../lib/content/store-hours";

test.setTimeout(240_000);
test.beforeEach(async ({ page }) => {
  // Read-only storefront verification; do not send test visits to ad collectors.
  await page.route(
    /google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|facebook\.com\/tr|clarity\.ms/,
    (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }),
  );
});

test("shop hours, address, contact map and size guides stay consistent on deployed pages", async ({
  page,
  request,
}, testInfo) => {
  const guards = installPageGuards(page);
  const feed = await request.get("/google-merchant.xml", { timeout: 90_000 });
  expect(feed.status()).toBe(200);
  const link = (await feed.text()).match(/<g:link>([^<]+)<\/g:link>/)?.[1];
  expect(link).toBeTruthy();
  const productPath = new URL(link!.replaceAll("&amp;", "&")).pathname;
  const routes = [
    { path: "/en/", locale: "en" },
    { path: `/en${productPath}`, locale: "en" },
    { path: productPath, locale: "vi" },
    { path: "/huong-dan/size-trang-phuc/", locale: "vi" },
    { path: "/en/guide/clothing-size/", locale: "en" },
    { path: "/lien-he/", locale: "vi" },
    { path: "/en/contact/", locale: "en" },
  ];
  for (const { path, locale } of routes) {
    const response = await page.goto(path, { waitUntil: "networkidle", timeout: 90_000 });
    expect(response?.status(), path).toBe(200);
    const html = await response!.text();
    expect(html, path).not.toMatch(
      /18:00|18h00|6:00 PM|\b6 PM\b|Ward 14|District 11|\{\{store_hours\}\}/,
    );
    const hours = getStoreHours(locale);
    const footer = page.locator("[data-footer-hours]");
    for (const line of Object.values(hours)) await expect(footer).toContainText(line);
    if (path === "/en/") {
      await expect(page.getByText(/Visit the store at/)).toContainText(hours.weekend);
    }
    if (path.includes("size")) {
      await expect(page.locator("main")).toContainText(hours.weekday);
      await expect(page.locator("main")).toContainText(hours.weekend);
    }
    if (path === "/lien-he/" || path === "/en/contact/") {
      const schedule = page.locator("[data-contact-hours]");
      await expect(schedule.locator("p")).toHaveCount(3);
      for (const line of Object.values(hours))
        await expect(schedule.getByText(line, { exact: true })).toHaveCount(1);
      if (locale === "en")
        await expect(page.locator("main")).toContainText("Hoa Binh Ward, Ho Chi Minh City");
      const map = page.locator('iframe[title*="map"], iframe[title*="Bản đồ"]');
      await expect(map).toHaveAttribute(
        "src",
        "https://maps.google.com/maps?cid=10172478217895770333&output=embed",
      );
      const directions = page.getByRole("link", {
        name: locale === "vi" ? "Chỉ đường" : "Directions",
        exact: true,
      });
      await expect(directions).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&destination=Shop+Bigbike&destination_place_id=ChIJeXyMi5UudTER3XgTBwvnK40",
      );
      await expect(directions).toHaveAttribute("target", "_blank");
      await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
      for (const viewport of [DESKTOP, MOBILE]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await expect(directions).toBeVisible();
        const mapBox = await map.boundingBox();
        const buttonBox = await directions.boundingBox();
        expect(buttonBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height);
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: testInfo.outputPath(`contact-${locale}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }
  }
  await testInfo.attach("runtime", {
    body: JSON.stringify(guards, null, 2),
    contentType: "application/json",
  });
  expect(summarizeGuards(guards).serious).toEqual([]);
  expect(guards.badResponses.filter((r) => /\/api\//.test(r.url) && r.status >= 400)).toEqual([]);
});
