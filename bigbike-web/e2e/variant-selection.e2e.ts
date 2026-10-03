import { expect, test, type Locator } from "@playwright/test";
import type { Product } from "@/lib/contracts/public";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  installPageGuards,
} from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";

const slug = "ls2-mx702-pioneer-ii";
const viewports = VIEWPORTS.filter(({ width }) => [375, 768, 1440].includes(width));

function colorOption(variant: NonNullable<Product["variants"]>[number]) {
  const option = variant.options?.find(({ name }) => /^(color|colour|màu)/iu.test(name.trim()));
  expect(option, `Variant ${variant.name} needs a color option`).toBeTruthy();
  return option!;
}

function colorRadioLabel(variant: NonNullable<Product["variants"]>[number], locale: "vi" | "en") {
  const option = colorOption(variant);
  return locale === "en" ? option.accessibilityLabel || option.value : option.value;
}

async function expectGalleryImage(section: Locator, imageUrl: string) {
  const image = section.locator("[data-product-gallery-main] .swiper-slide-active img").first();
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const src = await image.getAttribute("src");
      return decodeURIComponent(src ?? "");
    })
    .toContain(imageUrl);
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    )
    .toBe(true);
}

// Read the reported product without changing catalog, cart or order data.
for (const viewport of viewports) {
  test.describe(`Pioneer II color selection @${viewport.width}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const locale of ["vi", "en"] as const) {
      test(`one color selection stays aligned with the gallery and linked variant (${locale})`, async ({
        page,
        request,
      }, testInfo) => {
        await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
        const guards = installPageGuards(page);
        const response = await request.get(
          `http://localhost:8080/api/v1/products/${slug}?lang=${locale}`,
        );
        expect(response.ok()).toBe(true);
        const { data: product } = (await response.json()) as { data: Product };
        const black = product.variants!.find((variant) => variant.name === "ĐEN - XL")!;
        const red = product.variants!.find((variant) => variant.name === "namib đỏ - XL")!;
        expect(black).toBeTruthy();
        expect(red).toBeTruthy();
        const blackColor = colorOption(black);
        const redColor = colorOption(red);
        const blackLabel = colorRadioLabel(black, locale);
        const redLabel = colorRadioLabel(red, locale);
        if (locale === "en") {
          expect(blackLabel).toBe("Black");
          expect(redLabel).toBe("namib Red");
        }
        const localizedSlug =
          locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
        const path = `${locale === "en" ? "/en" : ""}/product/${localizedSlug}/`;
        await page.goto(path, { waitUntil: "networkidle" });
        const section = page.locator("[data-purchase-section]");
        const groups = section.locator('[data-variant-picker] [role="radiogroup"]');
        await expect(groups).toHaveCount(2);
        const colors = section.getByRole("radiogroup", { name: /màu sắc|color/i });
        await expect(colors).toHaveCount(1);
        await expect(colors.getByRole("radio")).toHaveCount(2);
        const add = section.locator("[data-purchase-add]");
        await expect(add).toBeDisabled();
        const redChip = colors.getByRole("radio", { name: redLabel, exact: true });
        await expect(redChip).toHaveAttribute("value", redColor.value);
        await redChip.click();
        await expect(add).toBeDisabled();
        await section.getByRole("radio", { name: "XL", exact: true }).click();
        await expect(add).toBeEnabled({ enabled: red.isAvailable });
        await expectGalleryImage(section, red.gallery?.[0]?.image?.url ?? red.image!.url);

        const blackChip = colors.getByRole("radio", { name: blackLabel, exact: true });
        await expect(blackChip).toHaveAttribute("value", blackColor.value);
        await blackChip.click();
        await expect(colors.locator('[aria-checked="true"]')).toHaveCount(1);
        await expect(redChip).toHaveAttribute("aria-checked", "false");
        await expect(add).toBeEnabled({ enabled: black.isAvailable });
        await expectGalleryImage(section, black.gallery?.[0]?.image?.url ?? black.image!.url);

        await page.goto(`${path}?variant=${encodeURIComponent(red.id)}`, {
          waitUntil: "networkidle",
        });
        await expect(groups).toHaveCount(2);
        await expect(colors.getByRole("radio", { name: redLabel, exact: true })).toHaveAttribute(
          "aria-checked",
          "true",
        );
        await expect(section.getByRole("radio", { name: "XL", exact: true })).toHaveAttribute(
          "aria-checked",
          "true",
        );
        await expectGalleryImage(section, red.gallery?.[0]?.image?.url ?? red.image!.url);
        await colors.getByRole("radio", { name: blackLabel, exact: true }).click();
        await expect(add).toBeEnabled({ enabled: black.isAvailable });
        await expectGalleryImage(section, black.gallery?.[0]?.image?.url ?? black.image!.url);
        await expectNoHorizontalOverflow(page, `${locale} ${viewport.width}`);
        await section.screenshot({ path: testInfo.outputPath("color-selection.png") });
        expectNoSeriousIssues(guards, `${path} @${viewport.width}`);
      });
    }
  });

  test.describe(`RSY271 size selection @${viewport.width}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const locale of ["vi", "en"]) {
      test(`one size group replaces the previous choice and preserves linked sizes (${locale})`, async ({
        page,
        request,
      }, testInfo) => {
        await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
        const guards = installPageGuards(page);
        const response = await request.get(
          `http://localhost:8080/api/v1/products/quan-moto-mua-he-taichi-rsy271?lang=${locale}`,
        );
        expect(response.ok()).toBe(true);
        const { data: product } = (await response.json()) as { data: Product };
        const variants = product.variants!;
        const bxl = variants.find((variant) =>
          variant.options?.some(({ value }) => value === "BXL"),
        )!;
        expect(bxl).toBeTruthy();
        const localizedSlug =
          locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
        const path = `${locale === "en" ? "/en" : ""}/product/${localizedSlug}/`;
        // Wait for page resources, then assert the actual controls; background tracking may keep fetching.
        await page.goto(path, { waitUntil: "load" });
        const section = page.locator("[data-purchase-section]");
        const groups = section.locator('[data-variant-picker] [role="radiogroup"]');
        await expect(groups).toHaveCount(1);
        const sizeLabel = locale === "vi" ? "Kích cỡ" : "Size";
        await expect(groups).toHaveAttribute("aria-label", sizeLabel);
        await expect(section.locator("[data-variant-picker] > div > p")).toHaveText(sizeLabel);
        await expect(groups.getByRole("radio")).toHaveCount(3);
        const add = section.locator("[data-purchase-add]");
        await expect(add).toBeDisabled();

        for (const size of ["XXL", "BXL", "XL"]) {
          const selected = variants.find((variant) =>
            variant.options?.some(({ value }) => value === size),
          )!;
          expect(selected).toBeTruthy();
          await groups.getByRole("radio", { name: size, exact: true }).click();
          await expect(groups.getByRole("radio", { checked: true })).toHaveCount(1);
          await expect(groups.getByRole("radio", { name: size, exact: true })).toHaveAttribute(
            "aria-checked",
            "true",
          );
          await expect(add).toBeEnabled({
            enabled: selected.isAvailable && selected.stockState !== "OUT_OF_STOCK",
          });
        }
        await groups.getByRole("radio", { name: "XL", exact: true }).click();
        await expect(groups.getByRole("radio", { checked: true })).toHaveCount(0);
        await expect(add).toBeDisabled();

        await page.goto(`${path}?variant=${encodeURIComponent(bxl.id)}`, {
          waitUntil: "load",
        });
        await expect(groups).toHaveCount(1);
        await expect(groups.getByRole("radio", { name: "BXL", exact: true })).toHaveAttribute(
          "aria-checked",
          "true",
        );
        await expect(add).toBeEnabled({
          enabled: bxl.isAvailable && bxl.stockState !== "OUT_OF_STOCK",
        });
        await groups.getByRole("radio", { name: "XXL", exact: true }).click();
        await expect(groups.getByRole("radio", { checked: true })).toHaveCount(1);
        await expect(groups.getByRole("radio", { name: "BXL", exact: true })).toHaveAttribute(
          "aria-checked",
          "false",
        );
        const xxl = variants.find((variant) =>
          variant.options?.some(({ value }) => value === "XXL"),
        )!;
        await expect(add).toBeEnabled({
          enabled: xxl.isAvailable && xxl.stockState !== "OUT_OF_STOCK",
        });
        await expectNoHorizontalOverflow(page, `${locale} ${viewport.width}`);
        await section.screenshot({ path: testInfo.outputPath("size-selection.png") });
        expectNoSeriousIssues(guards, `${path} @${viewport.width}`);
      });
    }

    test("size heading follows the language switch VI → EN → VI", async ({
      page,
      request,
    }, testInfo) => {
      await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
      const guards = installPageGuards(page);
      const response = await request.get(
        "http://localhost:8080/api/v1/products/quan-moto-mua-he-taichi-rsy271",
      );
      expect(response.ok()).toBe(true);
      const { data: product } = (await response.json()) as { data: Product };
      const bxl = product.variants!.find((variant) =>
        variant.options?.some(({ value }) => value === "BXL"),
      )!;
      expect(bxl).toBeTruthy();
      await page.goto(`/product/${product.slug}/?variant=${encodeURIComponent(bxl.id)}`, {
        waitUntil: "load",
      });
      const section = page.locator("[data-purchase-section]");
      const picker = section.locator("[data-variant-picker]");
      const languageSwitch = page.locator("[data-language-switch]");

      for (const [index, locale] of (["vi", "en", "vi"] as const).entries()) {
        await test.step(`heading and choices in ${locale} (${index})`, async () => {
          if (index > 0) {
            const languageName = locale === "en" ? "English" : "Tiếng Việt";
            if (viewport.width < 768) {
              await languageSwitch.getByRole("combobox").click();
              await page.getByRole("option", { name: languageName, exact: true }).click();
            } else {
              await languageSwitch.getByRole("button", { name: languageName, exact: true }).click();
            }
          }
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(languageSwitch).toHaveAttribute("aria-busy", "false");
          const localizedSlug =
            locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
          await expect(page).toHaveURL(
            `${process.env.PW_BASE_URL || "http://localhost:3000"}${locale === "en" ? "/en" : ""}/product/${localizedSlug}/?variant=${encodeURIComponent(bxl.id)}`,
          );
          const label = locale === "vi" ? "Kích cỡ" : "Size";
          await expect(picker.locator(":scope > div > p")).toHaveText(label);
          await expect(picker.getByRole("radiogroup", { name: label, exact: true })).toHaveCount(1);
          await expect(picker.getByRole("radio")).toHaveText(["XL", "BXL", "XXL"]);
          await expect(picker.getByRole("radio", { name: "BXL", exact: true })).toHaveAttribute(
            "aria-checked",
            "true",
          );
          await expect(section.locator("[data-purchase-add]")).toBeEnabled({
            enabled: bxl.isAvailable && bxl.stockState !== "OUT_OF_STOCK",
          });
          await expectNoHorizontalOverflow(page, `${locale} ${viewport.width}`);
          await picker.screenshot({
            path: testInfo.outputPath(`size-label-${index}-${locale}.png`),
          });
        });
      }
      expectNoSeriousIssues(guards, `size label language switch @${viewport.width}`);
    });
  });
}
