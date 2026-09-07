import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS } from "./helpers/viewports";
import {
  expectNoHorizontalOverflow,
  installPageGuards,
  summarizeGuards,
} from "./helpers/ui-quality";

type Offer = {
  id: string;
  link: string;
  price: string;
  salePrice: string;
  image: string;
  availability: string;
  group: string;
  options: { name: string; value: string }[];
};

let offers: Offer[];
const previewOrigin = process.env.GMC_PREVIEW_ORIGIN;
const viewports = VIEWPORTS.filter((viewport) =>
  ["mobile-375x812", "tablet-768x1024", "desktop-1440x900"].includes(viewport.name),
);

// A preview on the VPS can serve the storefront under its real browser origin.
// Only transport is forwarded; the backend, media and catalog remain real.
async function forwardPreview(page: Page, baseURL: string) {
  if (!previewOrigin) return;
  await page.route(`${new URL(baseURL).origin}/**`, async (route) => {
    const source = new URL(route.request().url());
    const response = await route.fetch({
      url: new URL(source.pathname + source.search, previewOrigin).href,
    });
    await route.fulfill({ response });
  });
}

test.describe("Google Merchant — nguồn thật và lựa chọn sản phẩm", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async ({ page }) => {
    // Assertions already checked runtime errors. Page teardown cancels background
    // prefetches; discard only the resulting late forwarding callback errors.
    if (previewOrigin) await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test.beforeAll(async ({ request, browser, baseURL }) => {
    const response = await request.get(
      new URL("/google-merchant.xml", previewOrigin ?? baseURL).href,
      { timeout: 60_000 },
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/xml");
    expect(response.headers()["cache-control"]).toContain("no-store");
    const page = await browser.newPage();
    try {
      offers = await page.evaluate(
        (xml) => {
          const document = new DOMParser().parseFromString(xml, "application/xml");
          if (document.querySelector("parsererror")) throw new Error("Invalid feed XML");
          return Array.from(document.querySelectorAll("item")).map((item) => {
            const value = (name: string) =>
              item.getElementsByTagNameNS("http://base.google.com/ns/1.0", name)[0]?.textContent ??
              "";
            return {
              id: value("id"),
              link: value("link"),
              price: value("price"),
              salePrice: value("sale_price"),
              image: value("image_link"),
              availability: value("availability"),
              group: value("item_group_id"),
              options: Array.from(
                item.getElementsByTagNameNS("http://base.google.com/ns/1.0", "variant_option"),
              ).map((option) => ({
                name:
                  option.getElementsByTagNameNS("http://base.google.com/ns/1.0", "name")[0]
                    ?.textContent ?? "",
                value:
                  option.getElementsByTagNameNS("http://base.google.com/ns/1.0", "value")[0]
                    ?.textContent ?? "",
              })),
            };
          });
        },
        await response.text(),
      );
    } finally {
      await page.close();
    }
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.length).toBe(Number(response.headers()["x-merchant-item-count"]));
    expect(new Set(offers.map((offer) => offer.id.normalize("NFC").toLowerCase())).size).toBe(
      offers.length,
    );
    for (const offer of offers) {
      expect(offer.id).not.toBe("");
      expect(offer.price).toMatch(/^\d+ VND$/);
      expect(offer.image).toMatch(/^https?:\/\//);
      expect(["in_stock", "out_of_stock"]).toContain(offer.availability);
    }
  });

  async function checkLanding(page: Page, offer: Offer, baseURL: string) {
    await forwardPreview(page, baseURL);
    const guards = installPageGuards(page);
    const link = new URL(offer.link);
    const response = await page.goto(link.pathname + link.search, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    // Check the initial HTTP HTML, before browser hydration can change it.
    const html = await response!.text();
    const structured = [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs),
    ].map((match) => JSON.parse(match[1]));
    const product = structured.find((item) => item["@type"] === "Product" && item.sku === offer.id);
    expect(product).toBeDefined();
    expect(product.inProductGroupWithID).toBe(offer.group);
    expect(String(product.offers.price)).toBe((offer.salePrice || offer.price).split(" ")[0]);
    expect(product.offers.availability).toBe(
      `https://schema.org/${offer.availability === "in_stock" ? "InStock" : "OutOfStock"}`,
    );
    expect(product.image).toContain(offer.image);
    expect(product.offers.url).toBe(offer.link);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      link.origin + link.pathname,
    );

    const buyBox = page.locator("[data-purchase-info]");
    for (const option of offer.options) {
      await expect(buyBox.getByRole("radio", { name: option.value, exact: true })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    }
    const price = Number((offer.salePrice || offer.price).split(" ")[0]).toLocaleString("vi-VN");
    await expect(buyBox.getByText(`${price} ₫`, { exact: true })).toBeVisible();
    await expect(
      buyBox.locator(offer.availability === "in_stock" ? ".stock.in-stock" : ".stock.out-of-stock"),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, offer.id);
    expect(summarizeGuards(guards).serious).toEqual([]);
  }

  for (const viewport of viewports) {
    test(`mở đúng biến thể còn hàng — ${viewport.name}`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize(viewport);
      const offer = offers.find(
        (item) => item.group && item.options.length >= 2 && item.availability === "in_stock",
      );
      expect(offer, "Danh mục thật cần có biến thể còn hàng để kiểm tra").toBeDefined();
      await checkLanding(page, offer!, baseURL!);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}.png`), fullPage: false });
    });
  }

  test("biến thể hết hàng giữ nguyên lựa chọn và trạng thái", async ({ page, baseURL }) => {
    const offer = offers.find(
      (item) => item.group && item.options.length >= 2 && item.availability === "out_of_stock",
    );
    expect(offer, "Danh mục thật cần có biến thể hết hàng để kiểm tra").toBeDefined();
    await checkLanding(page, offer!, baseURL!);
  });
});
