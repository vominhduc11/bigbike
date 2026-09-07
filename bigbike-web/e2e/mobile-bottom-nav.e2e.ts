import { test, expect, type Page } from "@playwright/test";
import {
  gotoAndSettle,
  expectNoHorizontalOverflow,
  installPageGuards,
  summarizeGuards,
} from "./helpers/ui-quality";
import { DESKTOP, MOBILE } from "./helpers/viewports";

const NARROW_MOBILE = { width: 320, height: MOBILE.height };

async function layout(page: Page) {
  return page.locator(".bb-bottom-nav").evaluate((nav) => {
    const rect = nav.getBoundingClientRect();
    const safeArea =
      Number.parseFloat(getComputedStyle(nav).getPropertyValue("--bb-mobile-nav-safe-area")) || 0;
    const tabs = [...nav.querySelectorAll<HTMLElement>(":scope > div > a, :scope > div > button")];
    return {
      height: rect.height,
      reservedHeight:
        Number.parseFloat(
          document.documentElement.style.getPropertyValue("--bb-mobile-nav-height"),
        ) + safeArea,
      tabs: tabs.map((tab) => {
        const label = tab.querySelector<HTMLElement>("[data-bottom-nav-label]")!;
        const icon = tab.querySelector("svg")!.getBoundingClientRect();
        const box = tab.getBoundingClientRect();
        const words = [...(label.textContent ?? "").matchAll(/\S+/g)];
        return {
          text: label.textContent,
          clipped:
            label.scrollWidth > label.clientWidth + 1 ||
            label.scrollHeight > label.clientHeight + 1,
          brokenWord: words.some((word) => {
            const range = document.createRange();
            range.setStart(label.firstChild!, word.index!);
            range.setEnd(label.firstChild!, word.index! + word[0].length);
            return range.getClientRects().length > 1;
          }),
          lines: Math.round(
            label.clientHeight / Number.parseFloat(getComputedStyle(label).lineHeight),
          ),
          top: box.top,
          height: box.height,
          width: box.width,
          iconTop: icon.top,
          iconWidth: icon.width,
        };
      }),
    };
  });
}

for (const locale of ["vi", "en"] as const) {
  const home = locale === "vi" ? "/" : "/en/";
  const searchPath = locale === "vi" ? "/tim-kiem/?s=mu" : "/en/search/?s=helmet";
  const searchLabel = locale === "vi" ? "Tìm kiếm" : "Search";

  test.describe(`Mobile bottom navigation ${locale}`, () => {
    test.use({ viewport: NARROW_MOBILE });

    test("keeps full labels, aligned icons and enough bottom space with enlarged text", async ({
      page,
    }, testInfo) => {
      const guards = installPageGuards(page);
      await gotoAndSettle(page, home, { scroll: false });
      const nav = page.locator(".bb-bottom-nav");
      await expect(nav).toBeVisible();

      for (const viewport of [NARROW_MOBILE, MOBILE]) {
        await page.setViewportSize(viewport);
        for (const fontScale of [100, 125, 200]) {
          await page.evaluate((scale) => {
            document.documentElement.style.fontSize = `${scale}%`;
          }, fontScale);
          await expect
            .poll(async () => {
              const measurement = await layout(page);
              return (
                measurement.reservedHeight >= measurement.height &&
                measurement.reservedHeight - measurement.height < 2
              );
            })
            .toBe(true);
          const measurement = await layout(page);
          expect(measurement.tabs).toHaveLength(4);
          expect(
            measurement.tabs.filter((tab) => tab.clipped || tab.brokenWord),
            `${viewport.width}px, text ${fontScale}%`,
          ).toEqual([]);
          const rows = [...new Set(measurement.tabs.map((tab) => tab.top))];
          const twoRows = fontScale === 200 || (fontScale === 125 && viewport.width === 320);
          expect(rows).toHaveLength(twoRows ? 2 : 1);
          for (const tab of measurement.tabs) {
            expect(tab.width).toBeGreaterThanOrEqual(44);
            expect(tab.height).toBeGreaterThanOrEqual(48);
            const firstInRow = measurement.tabs.find((item) => item.top === tab.top)!;
            expect(tab.iconTop).toBeCloseTo(firstInRow.iconTop, 0);
            expect(tab.height).toBeCloseTo(measurement.tabs[0].height, 0);
            expect(tab.iconWidth).toBeCloseTo((24 * fontScale) / 100, 0);
            if (fontScale === 100) expect(tab.lines).toBe(1);
          }
          await expectNoHorizontalOverflow(
            page,
            `bottom navigation ${locale} ${viewport.width}px ${fontScale}%`,
          );
          await nav.screenshot({
            path: testInfo.outputPath(`bottom-nav-${viewport.width}-${fontScale}.png`),
          });
        }
      }

      await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
      // Mô phỏng vùng an toàn đáy để xác minh chỉ cộng một lần vào phần chừa chỗ.
      await nav.evaluate((element) =>
        (element as HTMLElement).style.setProperty("--bb-mobile-nav-safe-area", "34px"),
      );
      await expect
        .poll(async () => {
          const measurement = await layout(page);
          return Math.abs(measurement.reservedHeight - measurement.height) < 2;
        })
        .toBe(true);
      await page.setViewportSize(DESKTOP);
      await expect(nav).toBeHidden();
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.style.getPropertyValue("--bb-mobile-nav-height"),
          ),
        )
        .toBe("");
      await page.setViewportSize(MOBILE);
      await expect(nav).toBeVisible();
      await expect.poll(async () => (await layout(page)).reservedHeight > 0).toBe(true);
      await testInfo.attach("runtime-report", {
        body: JSON.stringify(summarizeGuards(guards), null, 2),
        contentType: "application/json",
      });
      expect(guards.pageErrors).toEqual([]);
    });

    test("marks search results and restores focus after closing search", async ({
      page,
    }, testInfo) => {
      const guards = installPageGuards(page);
      await gotoAndSettle(page, searchPath, { scroll: false });
      const nav = page.locator(".bb-bottom-nav");
      const search = nav.getByRole("button", { name: searchLabel, exact: true });
      await expect(search).toHaveAttribute("aria-current", "page");
      await expect(search).toHaveAttribute("aria-pressed", "false");
      expect(await search.evaluate((element) => getComputedStyle(element).color)).not.toBe(
        await nav
          .getByRole("link")
          .last()
          .evaluate((element) => getComputedStyle(element).color),
      );

      await search.click();
      const dialog = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("combobox") })
        .first();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(search).toBeFocused();
      await expect(search).toHaveAttribute("aria-current", "page");

      await nav.getByRole("link").first().click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(home);
      await expect(nav.getByRole("link").first()).toHaveAttribute("aria-current", "page");
      await expect(search).not.toHaveAttribute("aria-current");
      await testInfo.attach("runtime-report", {
        body: JSON.stringify(summarizeGuards(guards), null, 2),
        contentType: "application/json",
      });
      expect(guards.pageErrors).toEqual([]);
    });
  });
}
