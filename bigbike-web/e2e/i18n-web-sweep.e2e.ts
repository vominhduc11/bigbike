import { expect, test } from "@playwright/test";
import { routing } from "@/i18n/routing";
import { translatePath } from "@/lib/utils/routes";
import en from "@/messages/en.json";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import { expectNoSeriousIssues, installPageGuards, summarizeGuards } from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";

function messageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    messageKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}
const keys = messageKeys(en);
const authPaths = new Set(["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/xac-nhan-email"]);
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
const staticPaths = Object.keys(routing.pathnames).filter(
  (path) => !path.includes("[") && !path.startsWith("/preview/") && !path.startsWith("/tai-khoan"),
);
const mobilePaths = new Set([
  "/",
  "/sp",
  "/dang-nhap",
  "/gio-hang",
  "/dat-hang",
  "/tu-choi-thu-moi-danh-gia",
]);

// All public static route types on desktop, critical navigation/commerce on mobile.
// Guest-only: no login, order, email, photo upload or opt-out submission.
for (const viewport of VIEWPORTS.filter(({ width }) => [375, 1440].includes(width))) {
  test.describe(`Web language sweep @${viewport.width}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    for (const path of staticPaths.filter(
      (path) => viewport.width === 1440 || mobilePaths.has(path),
    )) {
      test(`${path}: VI → EN → VI`, async ({ page }, testInfo) => {
        await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
        const guards = installPageGuards(page);
        const initial = await page.goto(translatePath(path, "vi"), { waitUntil: "load" });
        expect(initial?.ok()).toBe(true);
        const languageSwitch = page.locator("[data-language-switch]");
        const observations: unknown[] = [];
        for (const [index, locale] of (["vi", "en", "vi"] as const).entries()) {
          await test.step(`${locale} (${index})`, async () => {
            if (index > 0 && authPaths.has(path)) {
              await page.goto(translatePath(path, locale), { waitUntil: "load" });
            } else if (index > 0) {
              const name = locale === "en" ? "English" : "Tiếng Việt";
              if (viewport.width < 768) {
                await languageSwitch.getByRole("combobox").click();
                await page.getByRole("option", { name, exact: true }).click();
              } else {
                await languageSwitch.getByRole("button", { name, exact: true }).click();
              }
            }
            await expect(page.locator("html")).toHaveAttribute("lang", locale);
            if (!authPaths.has(path))
              await expect(languageSwitch).toHaveAttribute("aria-busy", "false");
            // Contact intentionally has no hero; wait for its localized store-information heading.
            const heading =
              path === "/lien-he"
                ? page.locator("main").getByRole("heading", {
                    name: locale === "vi" ? "Thông tin cửa hàng" : "Store information",
                    exact: true,
                  })
                : page.locator("main h1").first();
            await expect(heading).toBeVisible({ timeout: 30_000 });
            await expect(page).toHaveURL(
              new URL(
                translatePath(path, locale),
                process.env.PW_BASE_URL || "http://localhost:3000",
              ).href,
            );
            if (!authPaths.has(path))
              await expect(languageSwitch).toHaveAttribute(
                "aria-label",
                locale === "en" ? "Language" : "Ngôn ngữ",
              );
            const ui = await page.evaluate((catalogKeys) => {
              const visible = document.body.innerText;
              const labels = Array.from(
                document.querySelectorAll("[aria-label], [alt], [placeholder]"),
              )
                .flatMap((el) => [
                  el.getAttribute("aria-label"),
                  el.getAttribute("alt"),
                  el.getAttribute("placeholder"),
                ])
                .filter(Boolean);
              const text = `${visible}\n${labels.join("\n")}`;
              return {
                missing: catalogKeys.filter((key) => text.includes(key)),
                // Evidence for manual classification: proper names and API fallback are not automatically bugs.
                vietnameseLines: [
                  ...new Set(
                    visible
                      .split("\n")
                      .map((line) => line.trim())
                      .filter((line) => /[À-ỹ]/u.test(line)),
                  ),
                ].slice(0, 45),
              };
            }, keys);
            expect(
              ui.missing,
              "raw translation keys must not appear in UI or accessible labels",
            ).toEqual([]);
            observations.push({ locale, path: new URL(page.url()).pathname, ...ui });
          });
        }
        await testInfo.attach("language-observations", {
          body: JSON.stringify(
            { observations, guards: summarizeGuards(guards), pageErrors: guards.pageErrors },
            null,
            2,
          ),
          contentType: "application/json",
        });
        expectNoSeriousIssues(guards, `${path} @${viewport.width}`);
      });
    }
  });
}
