import { expect, test } from "@playwright/test";
import { getPolicyLinks } from "../lib/content/policy-pages";
import { translatePath } from "../lib/utils/routes";
import { MOBILE, DESKTOP, VIEWPORTS } from "./helpers/viewports";
import { expectNoHorizontalOverflow, installPageGuards } from "./helpers/ui-quality";

const SIZES = [
  { ...MOBILE, name: "narrow-320", width: 320 },
  ...VIEWPORTS.filter(({ width }) => [375, 390, 430, 768, 1024, 1440].includes(width)),
];

for (const locale of ["vi", "en"] as const) {
  test(`Footer ${locale}: mobile navigation, desktop resizing and complete shop details`, async ({
    page,
  }) => {
    const guards = installPageGuards(page);
    await page.setViewportSize(MOBILE);
    const response = await page.goto(
      translatePath("/chinh-sach/chinh-sach-bao-mat-thong-tin/", locale),
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBe(200);
    const footer = page.locator("footer").first();
    await expect(footer.locator("[data-footer-intro]")).toHaveText(
      locale === "vi" ? "Liên hệ BigBike" : "Contact BigBike",
    );
    await expect(footer.locator("[data-footer-menu-link]")).toHaveCount(7);
    await expect(footer.locator("[data-footer-support-link]")).toHaveCount(3);
    await expect(footer.locator("[data-footer-business-details] > p")).toHaveCount(5);
    await expect(footer.locator("[data-footer-registration]")).toContainText("079190004735");
    await expect(footer.locator("[data-footer-registration] img")).toHaveAttribute(
      "src",
      /commerce-certification/,
    );
    await expect(footer.locator("[data-footer-contacts] a[href^='tel:']")).toHaveCount(2);
    await expect(footer.locator("[data-footer-contacts] a[href^='mailto:']")).toHaveCount(1);
    await expect(
      footer.locator(`[data-footer-contacts] a[href="${translatePath("/lien-he/", locale)}"]`),
    ).toHaveCount(1);

    for (const viewport of SIZES) {
      await page.setViewportSize(viewport);
      const desktop = viewport.width >= 1024;
      for (const section of ["menu", "support", "about"] as const) {
        const panel = footer.locator(`[data-footer-section="${section}"]`);
        const trigger = panel.getByRole("button");
        await expect(trigger).toHaveAttribute("aria-expanded", String(desktop));
        if (desktop) {
          await expect(trigger).toBeDisabled();
          await expect(panel.locator("[data-footer-content]")).toBeVisible();
        } else {
          await expect(trigger).toBeEnabled();
          await expect(panel.locator("[data-footer-content]")).toBeHidden();
          await expect(panel.locator("[data-footer-content]")).toHaveAttribute("inert", "");
        }
      }
      await expect(footer.locator("[data-footer-social] [data-footer-content]")).toBeVisible();
      await expectNoHorizontalOverflow(page, `footer ${locale} ${viewport.name}`);
      const bounds = await footer
        .locator("[data-footer-contacts] a, [data-footer-social] a")
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, height: rect.height };
          }),
        );
      for (const box of bounds) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    await page.setViewportSize(MOBILE);
    const information = footer.locator('[data-footer-section="menu"]');
    const menuTrigger = information.getByRole("button");
    await expect(menuTrigger).toBeEnabled();
    await expect(menuTrigger).toHaveAttribute("aria-expanded", "false");
    await menuTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(information.locator("[data-footer-content]")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(information.locator("a").first()).toBeFocused();
    const policyLinks = getPolicyLinks(locale);
    await expect(information.locator("a")).toHaveText(policyLinks.map(({ label }) => label));
    for (const [index, policy] of policyLinks.entries()) {
      await expect(information.locator("a").nth(index)).toHaveAttribute(
        "href",
        translatePath(policy.href, locale),
      );
    }

    // Changing the desktop breakpoint must not erase the customer's mobile choice.
    await page.setViewportSize(DESKTOP);
    await expect(menuTrigger).toBeDisabled();
    await page.setViewportSize(MOBILE);
    await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
    await menuTrigger.click();
    await expect(information.locator("[data-footer-content]")).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(footer.locator('[data-footer-section="support"] button')).toBeFocused();

    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expectNoHorizontalOverflow(page, `footer ${locale}, enlarged text`);
    const contactOverflow = await footer
      .locator("[data-footer-contacts]")
      .evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(contactOverflow).toBe(false);

    // Keep all network/console findings inspectable, including an unavailable
    // shared backend; the assertions here cover the footer and hydration itself.
    await test.info().attach("runtime-findings", {
      body: JSON.stringify(guards, null, 2),
      contentType: "application/json",
    });
    expect(guards.pageErrors).toEqual([]);
    expect(
      guards.consoleErrors.filter(({ text }) => /hydration|unique.*key|did not match/i.test(text)),
    ).toEqual([]);
  });
}
