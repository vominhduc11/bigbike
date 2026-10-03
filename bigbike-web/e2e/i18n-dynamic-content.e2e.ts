import { expect, test } from "@playwright/test";
import { toArticlePath, toBrandPath, toCategoryPath } from "@/lib/utils/routes";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import { expectNoSeriousIssues, installPageGuards } from "./helpers/ui-quality";
import { DESKTOP } from "./helpers/viewports";

type Entry = { slug: string; slugEn?: string; name?: string; title?: string };
const cases = [
  { resource: "categories", path: toCategoryPath },
  { resource: "brands", path: toBrandPath },
  { resource: "articles", path: toArticlePath },
] as const;

test.use({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
for (const entry of cases) {
  test(`Live ${entry.resource} content follows VI → EN → VI`, async ({
    page,
    request,
  }, testInfo) => {
    await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
    const guards = installPageGuards(page);
    const response = await request.get(
      `http://localhost:8080/api/v1/${entry.resource}?page=1&size=1&lang=vi`,
    );
    expect(response.ok()).toBe(true);
    const { data } = (await response.json()) as { data: Entry[] };
    expect(data.length).toBeGreaterThan(0);
    const viEntry = data[0];
    const translated = await request.get(
      `http://localhost:8080/api/v1/${entry.resource}/${viEntry.slug}?lang=en`,
    );
    expect(translated.ok()).toBe(true);
    const { data: enEntry } = (await translated.json()) as { data: Entry };
    await page.goto(entry.path(viEntry.slug, "vi"), { waitUntil: "load" });
    const languageSwitch = page.locator("[data-language-switch]");
    for (const [index, locale] of (["vi", "en", "vi"] as const).entries()) {
      await test.step(locale, async () => {
        if (index > 0) {
          await languageSwitch
            .getByRole("button", { name: locale === "en" ? "English" : "Tiếng Việt", exact: true })
            .click();
        }
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(languageSwitch).toHaveAttribute("aria-busy", "false");
        const current = locale === "en" ? enEntry : viEntry;
        const slug =
          locale === "en" && entry.resource !== "brands"
            ? current.slugEn || current.slug
            : current.slug;
        await expect(page).toHaveURL(
          new URL(entry.path(slug, locale), process.env.PW_BASE_URL || "http://localhost:3000")
            .href,
        );
        await expect(page.locator("main h1").first()).toHaveText(
          current.name || current.title || "",
          { timeout: 30_000 },
        );
      });
    }
    await testInfo.attach("runtime-observations", {
      body: JSON.stringify(guards, null, 2),
      contentType: "application/json",
    });
    expectNoSeriousIssues(guards, entry.resource);
  });
}
