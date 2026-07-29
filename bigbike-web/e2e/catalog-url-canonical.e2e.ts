import { expect, test } from "@playwright/test";

const CATEGORY_SLUG = "non-bao-hiem-moto";

test.describe("Canonical catalog URLs", () => {
  test("serves the new category URL with canonical, breadcrumb and internal links on the new base", async ({
    page,
  }) => {
    const response = await page.goto(`/danh-muc/${CATEGORY_SLUG}/`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/danh-muc/${CATEGORY_SLUG}/$`),
    );

    const renderedOldLinks = await page.locator('a[href*="/danh-muc-san-pham"]').count();
    expect(renderedOldLinks).toBe(0);

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join("\n")).toContain(`/danh-muc/${CATEGORY_SLUG}/`);
    expect(jsonLd.join("\n")).not.toContain("/danh-muc-san-pham/");
  });

  test("returns an exact 301 from legacy category URLs and preserves the query string", async ({
    request,
  }) => {
    const response = await request.get(
      `/danh-muc-san-pham/${CATEGORY_SLUG}/?utm_source=legacy`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(
      `/danh-muc/${CATEGORY_SLUG}/?utm_source=legacy`,
    );
  });

  test("redirects every old archive root directly to /sp/", async ({ request }) => {
    for (const source of [
      "/danh-muc-san-pham/",
      "/danh-muc-san-pham.html",
      "/danh-muc/",
      "/san-pham/",
    ]) {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status(), source).toBe(301);
      expect(response.headers().location, source).toBe("/sp/");
    }
  });

  test("uses /sp/ as the product-list canonical and sitemap entry", async ({ page, request }) => {
    const response = await page.goto("/sp/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/sp\/$/);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain("/sp/</loc>");
    expect(xml).not.toContain("/danh-muc-san-pham/");
    expect(xml).not.toContain("/san-pham/</loc>");
  });

  test("keeps the WordPress product alias under /sp/{slug}.html working", async ({ request }) => {
    const response = await request.get("/sp/agv-k1s.html", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});
