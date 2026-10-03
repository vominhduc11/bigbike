import { expect, test, type Page, type Route } from "@playwright/test";

import { gotoAndSettle } from "./helpers/ui-quality";
import { installPreviewBackendCors } from "./helpers/preview-backend";

type MeasuredEvent = {
  provider: "ga4" | "meta";
  name: string;
  params: Record<string, unknown>;
  options?: Record<string, unknown>;
};

const SINK_PATH = "/__e2e-analytics-sink";

async function fulfillWithoutCallingThirdParties(route: Route) {
  const isScript = route.request().resourceType() === "script";
  await route.fulfill({
    status: 200,
    contentType: isScript ? "application/javascript" : "text/plain",
    body: isScript ? "/* analytics blocked by BigBike E2E */" : "",
  });
}

async function prepareMeasurementSink(page: Page) {
  const events: MeasuredEvent[] = [];

  await installPreviewBackendCors(page);

  await page.route(`**${SINK_PATH}`, async (route) => {
    const payload = route.request().postDataJSON() as MeasuredEvent;
    events.push(payload);
    await route.fulfill({ status: 204 });
  });

  // Never dirty the real GA4/Clarity properties when this spec is pointed at a configured build.
  await page.route("**://www.googletagmanager.com/**", fulfillWithoutCallingThirdParties);
  await page.route("**://*.google-analytics.com/**", fulfillWithoutCallingThirdParties);
  await page.route("**://*.clarity.ms/**", fulfillWithoutCallingThirdParties);
  await page.route("**://c.bing.com/**", fulfillWithoutCallingThirdParties);
  await page.route("**://connect.facebook.net/**", fulfillWithoutCallingThirdParties);
  await page.route("**://www.facebook.com/**", fulfillWithoutCallingThirdParties);

  await page.addInitScript((sinkPath) => {
    const sendToSink =
      (provider: "ga4" | "meta") =>
      (...args: unknown[]) => {
        if (typeof args[1] !== "string") return;
        const isMeta = provider === "meta" && args[0] === "track";
        const isGa4 = provider === "ga4" && args[0] === "event";
        if (!isMeta && !isGa4) return;
        void fetch(sinkPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            name: args[1],
            params: args[2] ?? {},
            options: args[3] ?? undefined,
          }),
        });
      };
    (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = sendToSink("ga4");
    // This stays in-browser and intercepts every helper call; no Meta request is allowed to
    // leave the E2E browser, including when the test targets a configured production build.
    (window as Window & { fbq?: (...args: unknown[]) => void }).fbq = sendToSink("meta");
  }, SINK_PATH);

  return {
    events,
    async reconnectAfterDocumentLoad() {
      // A configured layout initializes GA and Meta after hydration. Replace them only inside this
      // browser after the document has settled; user actions below still exercise the production helper.
      await page.evaluate((sinkPath) => {
        (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = (
          ...args: unknown[]
        ) => {
          if (args[0] !== "event" || typeof args[1] !== "string") return;
          void fetch(sinkPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "ga4", name: args[1], params: args[2] ?? {} }),
          });
        };
        (window as Window & { fbq?: (...args: unknown[]) => void }).fbq = (...args: unknown[]) => {
          if (args[0] !== "track" || typeof args[1] !== "string") return;
          void fetch(sinkPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "meta",
              name: args[1],
              params: args[2] ?? {},
              options: args[3] ?? undefined,
            }),
          });
        };
      }, SINK_PATH);
    },
    async expectEvent(name: string, predicate?: (event: MeasuredEvent) => boolean) {
      await expect
        .poll(
          () =>
            events.filter(
              (event) =>
                event.provider === "ga4" && event.name === name && (!predicate || predicate(event)),
            ),
          { message: `Expected an outbound ${name} measurement request` },
        )
        .not.toHaveLength(0);
    },
    async expectMetaEvent(name: string, predicate?: (event: MeasuredEvent) => boolean) {
      await expect
        .poll(
          () =>
            events.filter(
              (event) =>
                event.provider === "meta" &&
                event.name === name &&
                (!predicate || predicate(event)),
            ),
          { message: `Expected an outbound Meta ${name} measurement request` },
        )
        .not.toHaveLength(0);
    },
  };
}

function expectNoPrivateCustomerFields(events: MeasuredEvent[]) {
  const payload = JSON.stringify(events);
  expect(payload).not.toMatch(/"(?:email|phone|address|full_name|customer_name)"\s*:/i);
}

async function keepMeasurementClicksInTheBrowser(page: Page) {
  // Register after each navigation. AnalyticsRuntime's delegated listener is registered first,
  // so it still observes the click while this test prevents a phone/social app or promotion
  // navigation from leaving the read-only scenario.
  await page.evaluate(() => {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (target?.matches('[href^="tel:"], [data-analytics-promotion-id]')) {
        event.preventDefault();
      }
    });
  });
}

test.describe("Storefront measurement @analytics", () => {
  test("records a settled quick search without calling live analytics", async ({ page }) => {
    const sink = await prepareMeasurementSink(page);
    await gotoAndSettle(page, "/", { scroll: false });
    await sink.reconnectAfterDocumentLoad();

    const input = page.locator('input[role="combobox"][aria-label]').first();
    await input.waitFor({ state: "attached" });
    await page.locator("button.bb-header-search-trigger").first().click();
    await expect(input).toBeFocused();
    await input.fill("balo");
    await sink.expectEvent(
      "search",
      (event) =>
        event.params.search_term === "balo" &&
        event.params.search_surface === "header_quick" &&
        typeof event.params.result_count === "number",
    );
    await sink.expectMetaEvent("Search", (event) => event.params.search_string === "balo");

    // Settled-query rerenders/refetches must not count as another customer search.
    await page.waitForTimeout(500);
    expect(
      sink.events.filter(
        (event) =>
          event.name === "search" &&
          event.params.search_term === "balo" &&
          event.params.search_surface === "header_quick",
      ),
    ).toHaveLength(1);

    expectNoPrivateCustomerFields(sink.events);
  });

  test("sends phone contact and homepage-promotion actions without calling live analytics", async ({
    page,
  }) => {
    const sink = await prepareMeasurementSink(page);
    await gotoAndSettle(page, "/", { scroll: false });
    await sink.reconnectAfterDocumentLoad();

    // Local/CI may omit analytics ids while a production-configured preview legitimately renders
    // the loaders. In both cases the routes above prevent any request from reaching a live
    // property; this assertion guards against installing either integration more than once.
    expect(await page.locator("#ga4-init").count()).toBeLessThanOrEqual(1);
    expect(await page.locator("#ga4-src").count()).toBeLessThanOrEqual(1);
    expect(await page.locator("#clarity-init").count()).toBeLessThanOrEqual(1);
    expect(await page.locator("#meta-pixel-init").count()).toBeLessThanOrEqual(1);
    const documentResponse = await page.request.get("/");
    const csp = documentResponse.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("https://www.clarity.ms");
    expect(csp).toContain("https://*.clarity.ms");
    expect(csp).toContain("https://c.bing.com");
    expect(csp).toContain("https://connect.facebook.net");
    await sink.expectMetaEvent("PageView");
    expect(
      sink.events.filter((event) => event.provider === "meta" && event.name === "PageView"),
    ).toHaveLength(1);

    // AnalyticsRuntime installs its document-level contact listener after hydration.
    await page.waitForTimeout(300);
    await keepMeasurementClicksInTheBrowser(page);
    const phone = page.locator('a[href^="tel:"]:visible').first();
    await expect(phone).toBeVisible();
    await phone.click();
    await sink.expectEvent(
      "contact_click",
      (event) => event.params.contact_channel === "phone" && event.params.placement === "footer",
    );
    await sink.expectMetaEvent("Contact", (event) => event.params.content_name === "phone");

    const promotion = page.locator("[data-analytics-promotion-id]:visible").first();
    await promotion.scrollIntoViewIfNeeded();
    await promotion.click();
    await sink.expectEvent("select_promotion");

    expectNoPrivateCustomerFields(sink.events);
  });

  test("sends ViewContent for a product opened from the homepage", async ({ page }) => {
    const sink = await prepareMeasurementSink(page);
    await gotoAndSettle(page, "/", { scroll: false });
    await sink.reconnectAfterDocumentLoad();

    const productLink = page.locator('a[href^="/product/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.locator("[data-analytics-product-id]")).toBeVisible();
    await sink.expectMetaEvent(
      "ViewContent",
      (event) =>
        Array.isArray(event.params.content_ids) &&
        typeof event.params.currency === "string" &&
        typeof event.params.value === "number",
    );

    expectNoPrivateCustomerFields(sink.events);
  });
});
