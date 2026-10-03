import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "./helpers/viewports";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  gotoAndSettle,
  installPageGuards,
} from "./helpers/ui-quality";

test.beforeEach(async ({ page }) => {
  await installPreviewBackendCors(page);
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

for (const locale of ["vi", "en"] as const) {
  for (const viewport of VIEWPORTS.filter(({ name }) =>
    ["mobile-375x812", "tablet-768x1024", "desktop-1440x900"].includes(name),
  )) {
    test(`${locale}: liên hệ trực tiếp tại ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const guards = installPageGuards(page);
      const chatRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/chat/")) chatRequests.push(request.url());
      });
      const response = await gotoAndSettle(page, locale === "vi" ? "/" : "/en/", { scroll: false });
      expect(response?.status()).toBe(200);
      const trigger = page.getByRole("button", {
        name: locale === "vi" ? "Mở hỗ trợ" : "Open support",
      });
      await expect(page.locator("#bb-floating-contact-trigger")).toHaveAttribute(
        "data-bigbike-contact-ready",
        "true",
      );
      const oldFabSize = viewport.width < 768 ? 48 : 66;
      await expect
        .poll(async () => Math.round((await trigger.boundingBox())!.width))
        .toBe(oldFabSize);
      const closedFab = (await trigger.boundingBox())!;
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const close = dialog.getByRole("button", {
        name: locale === "vi" ? "Đóng hỗ trợ" : "Close support",
      });
      const openFab = (await close.boundingBox())!;
      for (const coordinate of ["x", "y", "width", "height"] as const) {
        expect(openFab[coordinate]).toBeCloseTo(closedFab[coordinate], 0);
      }
      expect(await close.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
        "rgb(214, 214, 214)",
      );
      for (const asset of ["chat-hotline.png", "chat-zalo.svg", "chat-messenger.png"]) {
        const icon = dialog.locator(`img[src="/brand/home/${asset}"]`);
        await expect(icon).toBeVisible();
        await expect
          .poll(
            () => icon.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
            { timeout: 15000 },
          )
          .toBe(true);
      }
      await expect(dialog.getByRole("link", { name: /Hotline/ })).toHaveAttribute(
        "href",
        /^tel:\+?\d+/,
      );
      await expect(dialog.getByRole("link", { name: /Zalo/ })).toHaveAttribute(
        "href",
        /^https?:\/\//,
      );
      await expect(dialog.getByRole("link", { name: /Messager/ })).toHaveAttribute(
        "href",
        /^https?:\/\//,
      );
      await expect(dialog.getByRole("textbox")).toHaveCount(0);
      await expect(page.locator("[data-bigbike-assistant]")).toHaveCount(0);
      await expectNoHorizontalOverflow(page, "bảng liên hệ");
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({
        path: `/tmp/bigbike-direct-contact-${locale}-${viewport.width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(chatRequests).toEqual([]);
      expectNoSeriousIssues(guards, "liên hệ trực tiếp");
    });
  }
}
