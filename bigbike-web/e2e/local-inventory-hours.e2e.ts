import { expect, test } from "@playwright/test";

test.setTimeout(180_000);
test.beforeEach(({ page }) => {
  page.setDefaultNavigationTimeout(90_000);
});

test("local inventory matches the complete live main feed", async ({ request, page }) => {
  const [main, local] = await Promise.all([
    request.get("/google-merchant.xml", { timeout: 90_000 }),
    request.get("/google-local-inventory.tsv", { timeout: 90_000 }),
  ]);
  expect(main.status()).toBe(200);
  expect(local.status()).toBe(200);
  expect(local.headers()["content-type"]).toContain("text/tab-separated-values");
  const xml = await main.text();
  const tsv = await local.text();
  const items = await page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, "application/xml");
    return [...doc.querySelectorAll("item")].map((item) => {
      const field = (name: string) =>
        item.getElementsByTagNameNS("http://base.google.com/ns/1.0", name)[0]?.textContent;
      return [field("id"), field("availability"), field("sale_price") || field("price")];
    });
  }, xml);
  const [header, ...lines] = tsv.trimEnd().split("\n");
  expect(header).toBe("store_code\tid\tavailability\tprice");
  expect(lines).toHaveLength(items.length);
  expect(lines.map((line) => line.split("\t").slice(1))).toEqual(items);
  expect(new Set(lines.map((line) => line.split("\t")[0])).size).toBe(1);
});

test("VI and EN shop hours are consistent in page HTML and visible footer", async ({
  request,
  page,
}) => {
  const feed = await request.get("/google-merchant.xml", { timeout: 90_000 });
  const xml = await feed.text();
  const productUrl = xml.match(/<g:link>([^<]+)<\/g:link>/)?.[1];
  expect(productUrl).toBeTruthy();
  const productPath = new URL(productUrl!.replaceAll("&amp;", "&")).pathname;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Read-only browsing only; no real analytics traffic during verification.
  await page.route(
    /google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|facebook\.com\/tr|clarity\.ms/,
    (route) => route.abort(),
  );
  for (const path of ["/lien-he/", "/en/", productPath, `/en${productPath}`]) {
    const response = await request.get(path, { timeout: 90_000 });
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).not.toMatch(/18:00|18h00/);
    await page.goto(path);
    await expect(page.locator("[data-footer-hours]")).toContainText("9:00 – 21:00");
    await expect(page.locator("[data-footer-hours]")).toContainText("9:00 – 17:00");
  }
  expect(errors).toEqual([]);
});

test("locale changes preserve one Meta ViewContent observation", async ({ request, page }) => {
  const response = await request.get("/google-merchant.xml", { timeout: 90_000 });
  const link = (await response.text()).match(/<g:link>([^<]+)<\/g:link>/)?.[1];
  expect(link).toBeTruthy();
  const product = new URL(link!.replaceAll("&amp;", "&"));
  const events: unknown[][] = [];
  await page.exposeFunction("captureMeta", (...args: unknown[]) => events.push(args));
  await page.addInitScript(() => {
    const target = window as Window & {
      captureMeta: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };
    target.fbq = (...args) => target.captureMeta(...args);
  });
  await page.route(
    /google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|facebook\.com\/tr|clarity\.ms/,
    (route) => route.abort(),
  );
  await page.goto(product.pathname + product.search);
  const views = () => events.filter((event) => event[1] === "ViewContent");
  await expect.poll(() => views().length).toBe(1);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/product\//);
  await expect(page.locator("[data-footer-hours]")).toContainText("Mon – Sat");
  expect(views()).toHaveLength(1);
  await page.getByRole("button", { name: "Tiếng Việt", exact: true }).click();
  await expect(page.locator("[data-footer-hours]")).toContainText("T2 – T7");
  expect(views()).toHaveLength(1);
  expect(views()[0][3]).toMatchObject({ eventID: expect.any(String) });
});
