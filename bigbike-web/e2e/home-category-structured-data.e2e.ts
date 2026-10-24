import { expect, test, type Page } from "@playwright/test";
import { DESKTOP, VIEWPORTS } from "./helpers/viewports";
import {
  expectNoHorizontalOverflow,
  installPageGuards,
  summarizeGuards,
  type PageGuards,
} from "./helpers/ui-quality";

const ROUTES = [
  { path: "/danh-muc/mu-bao-hiem/", locale: "vi" },
  { path: "/danh-muc/mu-bao-hiem-fullface/", locale: "vi" },
  { path: "/danh-muc/tai-nghe-bluetooth-mu-bao-hiem/", locale: "vi" },
  { path: "/en/categories/motorcycle-helmet-intercom/", locale: "en" },
] as const;

async function readMarkup(page: Page, html: string | null = null) {
  return page.evaluate((html) => {
    const root = html === null ? document : new DOMParser().parseFromString(html, "text/html");
    return {
      intros: root.querySelectorAll(".bb-cat-intro").length,
      questions: root.querySelectorAll("h3.bb-ci-qt").length,
      lang: root.querySelector(".bb-cat-intro")?.getAttribute("lang"),
      schemas: [...root.querySelectorAll('script[type="application/ld+json"]')].map(
        (script) => JSON.parse(script.textContent ?? "") as Record<string, unknown>,
      ),
    };
  }, html);
}

function expectCategoryMarkup(markup: Awaited<ReturnType<typeof readMarkup>>, locale: string) {
  expect(markup.intros).toBe(1);
  expect(markup.questions).toBe(6);
  expect(markup.lang).toBe(locale);
  expect(markup.schemas.map((schema) => schema["@type"]).sort()).toEqual([
    "BreadcrumbList",
    "CollectionPage",
    "FAQPage",
  ]);
  const collection = markup.schemas.find((schema) => schema["@type"] === "CollectionPage")!;
  expect(collection.inLanguage).toBe(locale);
  expect(typeof collection.description).toBe("string");
  expect((collection.description as string).length).toBeGreaterThan(0);
  expect((collection.description as string).length).toBeLessThanOrEqual(160);
  expect(collection.description).not.toMatch(/Danh mục ·|Category ·|Nhóm Điểm mạnh Hạn chế/);
  const faq = markup.schemas.find((schema) => schema["@type"] === "FAQPage")!;
  expect(faq.mainEntity).toHaveLength(markup.questions);
}

function expectRuntime(guards: PageGuards) {
  // Cảnh báo Cloudflare có trước phiếu được ghi riêng, không coi console hoàn toàn sạch.
  const { serious, warnings } = summarizeGuards(guards);
  const known = serious.filter(
    (entry) =>
      entry.startsWith("[csp]") && entry.includes("static.cloudflareinsights.com/beacon.min.js"),
  );
  for (const entry of [...known, ...warnings]) {
    test.info().annotations.push({ type: "runtime-observation", description: entry });
  }
  expect(serious.filter((entry) => !known.includes(entry))).toEqual([]);
}

test.describe("SEO trang chủ và danh mục — phiếu 2026-10-22", () => {
  test.describe.configure({ mode: "serial", timeout: 180000 });

  for (const path of ["/", "/en/"]) {
    test(`trang chủ chỉ có graph doanh nghiệp và WebSite: ${path}`, async ({ page }) => {
      const guards = installPageGuards(page);
      const response = await page.goto(path, { waitUntil: "load" });
      expect(response?.status()).toBe(200);
      for (const html of [await response!.text(), null]) {
        const { schemas } = await readMarkup(page, html);
        expect(schemas).toHaveLength(2);
        const graph = schemas.find((schema) => schema["@graph"]);
        expect(graph?.["@graph"]).toMatchObject([
          { "@type": "Organization", name: "Shop Bigbike" },
          { "@type": "SportingGoodsStore", name: "Shop Bigbike", telephone: "+84764640679" },
        ]);
        expect(JSON.stringify(schemas)).not.toMatch(/LocalBusiness|0906 902 404/);
        const website = schemas.find((schema) => schema["@type"] === "WebSite");
        expect(website?.potentialAction).toMatchObject({ "@type": "SearchAction" });
      }
      expectRuntime(guards);
    });
  }

  for (const route of ROUTES) {
    test(`HTML và DOM nhất quán qua 5 lần tải: ${route.path}`, async ({ page }) => {
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      const guards = installPageGuards(page);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        expectCategoryMarkup(await readMarkup(page, await response!.text()), route.locale);
        await expect(page.locator("[data-collapsible-content]").first()).toHaveAttribute(
          "data-state",
          /collapsed|static/,
        );
        const markup = await readMarkup(page);
        expectCategoryMarkup(markup, route.locale);
        await test.info().attach(`load-${attempt + 1}`, {
          body: JSON.stringify(markup),
          contentType: "application/json",
        });
      }
      expectRuntime(guards);
    });
  }

  test("mô tả dự phòng chỉ lấy đoạn giới thiệu khi danh mục chưa nhập SEO", async ({ page }) => {
    const guards = installPageGuards(page);
    const response = await page.goto("/danh-muc/giay-mua-he/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator(".bb-cat-intro")).toHaveCount(1);
    const { schemas } = await readMarkup(page, await response!.text());
    const collection = schemas.find((schema) => schema["@type"] === "CollectionPage")!;
    const intro = (await page.locator(".bb-ci-body").first().innerText())
      .replace(/\s+/g, " ")
      .trim();
    const description = collection.description as string;
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(intro.startsWith(description.replace(/…$/, ""))).toBe(true);
    expectRuntime(guards);
  });

  for (const viewport of VIEWPORTS.filter((viewport) =>
    ["mobile-375x812", "tablet-768x1024", DESKTOP.name].includes(viewport.name),
  )) {
    test(`mở/thu intro và đổi danh mục không nhân đôi nội dung: ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const guards = installPageGuards(page);
      await page.goto(ROUTES[0].path, { waitUntil: "domcontentloaded" });
      const wrapper = page.locator("[data-collapsible-content]").first();
      await expect(wrapper).toHaveAttribute("data-state", "collapsed");
      const toggle = wrapper.locator("[data-collapsible-toggle]");
      await toggle.click();
      await expect(wrapper).toHaveAttribute("data-state", "expanded");
      expectCategoryMarkup(await readMarkup(page), "vi");
      await expectNoHorizontalOverflow(page, viewport.name);
      await toggle.click();
      await expect(wrapper).toHaveAttribute("data-state", "collapsed");

      if (viewport.kind === "desktop") {
        // Mở menu thật rồi đi tới danh mục con qua điều hướng phía client.
        await page.evaluate(() => window.scrollTo(0, 0));
        const menu = page
          .locator("[data-header-menu-item-with-children]")
          .filter({ has: page.locator(`a[href="${ROUTES[1].path}"]`) })
          .first();
        await menu.hover();
        await menu.locator(`[data-header-submenu-depth="0"] a[href="${ROUTES[0].path}"]`).hover();
        await menu.locator(`a[href="${ROUTES[1].path}"]`).click();
        await page.waitForURL(`**${ROUTES[1].path}`);
        await expect(page.locator("[data-collapsible-content]").first()).toHaveAttribute(
          "data-state",
          /collapsed|static/,
        );
        expectCategoryMarkup(await readMarkup(page), "vi");
      }
      expectRuntime(guards);
    });
  }
});
