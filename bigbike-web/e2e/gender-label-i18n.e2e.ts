import { expect, test } from "@playwright/test";
import type { Product } from "@/lib/contracts/public";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  installPageGuards,
} from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

const products = [
  { slug: "ao-bao-ho-cho-nu-ls2-airy-evo", vi: "Nữ", en: "Female" },
  { slug: "ao-bao-ho-mua-he-luoi-taichi-rsj351-air-flight", vi: "Nam", en: "Male" },
];

// Read-only: use a real published variant, never write catalog/cart/order data.
for (const viewport of VIEWPORTS.filter(({ width }) => [375, 768, 1440].includes(width))) {
  test.describe(`Gender labels @${viewport.width}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    for (const productCase of products) {
      test(`${productCase.en}: heading and choices follow VI → EN → VI without changing the linked variant`, async ({
        page,
        request,
      }, testInfo) => {
        await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
        const guards = installPageGuards(page);
        const response = await request.get(
          `http://localhost:8080/api/v1/products/${productCase.slug}`,
        );
        expect(response.ok()).toBe(true);
        const { data: product } = (await response.json()) as { data: Product };
        const variant = product.variants!.find(
          (v) =>
            v.isAvailable &&
            v.options?.some((o) => o.name === "Gender" && o.value === productCase.vi),
        );
        expect(variant).toBeTruthy();
        await page.goto(`/product/${product.slug}/?variant=${encodeURIComponent(variant!.id)}`, {
          waitUntil: "load",
        });
        const section = page.locator("[data-purchase-section]");
        const picker = section.locator("[data-variant-picker]");
        const languageSwitch = page.locator("[data-language-switch]");
        for (const [index, locale] of (["vi", "en", "vi"] as const).entries()) {
          await test.step(`gender labels in ${locale}`, async () => {
            if (index > 0) {
              const name = locale === "en" ? "English" : "Tiếng Việt";
              if (viewport.width < 768) {
                await languageSwitch.getByRole("combobox").click();
                await page.getByRole("option", { name, exact: true }).click();
              } else {
                await languageSwitch.getByRole("button", { name, exact: true }).click();
              }
            }
            await expect(page.locator("html")).toHaveAttribute("lang", locale);
            await expect(languageSwitch).toHaveAttribute("aria-busy", "false");
            const slug = locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
            await expect(page).toHaveURL(
              `${process.env.PW_BASE_URL || "http://localhost:3000"}${locale === "en" ? "/en" : ""}/product/${slug}/?variant=${encodeURIComponent(variant!.id)}`,
            );
            const heading = locale === "vi" ? "Giới tính" : "Gender";
            await expect(
              picker.getByRole("radiogroup", {
                name: locale === "vi" ? "Kích cỡ" : "Size",
                exact: true,
              }),
            ).toHaveCount(1);
            await expect(
              picker.getByRole("radiogroup", {
                name: locale === "vi" ? "Màu sắc" : "Color",
                exact: true,
              }),
            ).toHaveCount(1);
            await expect(
              picker.locator(":scope > div > p").filter({ hasText: new RegExp(`^${heading}$`) }),
            ).toHaveCount(1);
            const group = picker.getByRole("radiogroup", { name: heading, exact: true });
            const radio = group.getByRole("radio", {
              name: locale === "vi" ? productCase.vi : productCase.en,
              exact: true,
            });
            await expect(radio).toHaveAttribute("value", productCase.vi);
            await expect(radio).toHaveAttribute("aria-checked", "true");
            // Localized text must fit inside its button, including the longer English label.
            expect(
              await radio.evaluate((el) => {
                const text = el.querySelector("span")!.getBoundingClientRect();
                const button = el.getBoundingClientRect();
                return text.left >= button.left && text.right <= button.right;
              }),
            ).toBe(true);
            const add = section.locator("[data-purchase-add]");
            await expect(add).toBeEnabled();
            await radio.click();
            await expect(radio).toHaveAttribute("aria-checked", "false");
            await expect(add).toBeDisabled();
            await radio.click();
            await expect(radio).toHaveAttribute("aria-checked", "true");
            await expect(add).toBeEnabled();
            await expectNoHorizontalOverflow(page, `gender ${locale} @${viewport.width}`);
            await picker.screenshot({ path: testInfo.outputPath(`gender-${index}-${locale}.png`) });
          });
        }
        expectNoSeriousIssues(guards, `gender labels @${viewport.width}`);
      });
    }
  });
}
