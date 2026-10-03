import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import type { Product } from "@/lib/contracts/public";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  installPageGuards,
} from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";

// Owner chốt 2026-09-19: nhãn lựa chọn dài (vd "M8-3 thuận") phải nằm gọn trong ô của nó,
// không chồng sang ô bên; cả nhóm vẫn là MỘT HÀNG, nhiều ô thì khách vuốt ngang để xem tiếp.
// Chỉ đọc: dùng sản phẩm thật đang bán, không thêm giỏ, không đặt đơn.
const LONG_LABEL_SLUG = "oc-nang-chan-guong-kewig";
const SHORT_SIZE_SLUG = "ao-giap-moto-mua-he-ls2-breeze";
const PARTS_SLUG = "ao-lot-thun-lanh-mac-trong-giap-moto";
const CHIP = 52; // h-13 / min-w-13
const viewports = VIEWPORTS.filter(({ width }) => [375, 768, 1440].includes(width));

// Trang gọi giỏ hàng/khung chat ngay sau khi tải; phép đo xong sớm hơn các lượt gọi đó nên bỏ qua
// lỗi của lượt gọi còn dở khi đóng trang, không để nó đánh trượt oan phép kiểm giao diện.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

// Không gửi lượt xem của máy kiểm thử vào công cụ thống kê của shop.
async function blockAnalytics(page: Page) {
  await page.route(
    /google-analytics\.com|googletagmanager\.com|facebook\.(com|net)|doubleclick\.net/,
    (route) => route.abort(),
  );
}

async function loadProduct(request: APIRequestContext, slug: string, locale: "vi" | "en") {
  const response = await request.get(
    `http://localhost:8080/api/v1/products/${slug}?lang=${locale}`,
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { data: Product }).data;
}

async function openProduct(page: Page, product: Product, locale: "vi" | "en") {
  const slug = locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
  await page.goto(`${locale === "en" ? "/en" : ""}/product/${slug}/`, { waitUntil: "load" });
  return page.locator("[data-purchase-section] [data-variant-picker]");
}

function measureRow(group: Locator) {
  return group.evaluate((element) => {
    const chips = Array.from(element.querySelectorAll<HTMLElement>('[role="radio"]'));
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      chips: chips.map((chip) => {
        const style = getComputedStyle(chip);
        const range = document.createRange();
        range.selectNodeContents(chip.querySelector("span") ?? chip);
        return {
          text: chip.textContent ?? "",
          left: chip.offsetLeft,
          top: chip.offsetTop,
          width: chip.offsetWidth,
          height: chip.offsetHeight,
          room: chip.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          labelWidth: range.getBoundingClientRect().width,
          lines: new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size,
        };
      }),
    };
  });
}

type Row = Awaited<ReturnType<typeof measureRow>>;

function expectTidyRow(row: Row, label: string) {
  expect(row.chips.length, label).toBeGreaterThan(1);
  row.chips.forEach((chip, index) => {
    const name = `${label} "${chip.text}"`;
    expect(chip.height, `${name} cao đúng một ô`).toBe(CHIP);
    expect(chip.width, `${name} không hẹp hơn ô vuông`).toBeGreaterThanOrEqual(CHIP);
    expect(chip.lines, `${name} chữ nằm một dòng`).toBe(1);
    expect(chip.labelWidth, `${name} chữ nằm gọn trong ô`).toBeLessThanOrEqual(chip.room + 0.5);
    expect(chip.top, `${name} cùng một hàng`).toBe(row.chips[0].top);
    if (index > 0) {
      const previous = row.chips[index - 1];
      expect(chip.left, `${name} không đè lên "${previous.text}"`).toBeGreaterThanOrEqual(
        previous.left + previous.width,
      );
    }
  });
}

for (const viewport of viewports) {
  test.describe(`Variant option labels @${viewport.width}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const locale of ["vi", "en"] as const) {
      test(`long bolt sizes stay inside their boxes on one swipeable row (${locale})`, async ({
        page,
        request,
      }) => {
        await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
        await blockAnalytics(page);
        const guards = installPageGuards(page);
        const product = await loadProduct(request, LONG_LABEL_SLUG, locale);
        const groupName = product.variants![0].options![0].name;
        const values = product.variants!.map((variant) => variant.options![0].value);
        const label = `${LONG_LABEL_SLUG} ${locale} @${viewport.width}`;

        const picker = await openProduct(page, product, locale);
        const group = picker.getByRole("radiogroup", { name: groupName, exact: true });
        await expect(group.getByRole("radio")).toHaveCount(values.length);
        const row = await measureRow(group);
        expectTidyRow(row, label);
        const rowWidth = row.chips.reduce((sum, chip) => sum + chip.width, 0);
        if (rowWidth > row.clientWidth) {
          expect(row.scrollWidth, `${label} vuốt ngang được`).toBeGreaterThan(row.clientWidth);
        }

        // Ô cuối hàng vẫn tới được và chọn được, hiện trọn trong khung sau khi vuốt tới.
        const last = group.getByRole("radio", { name: values.at(-1)!, exact: true });
        await last.click();
        await expect(last).toHaveAttribute("aria-checked", "true");
        const fullyVisible = await last.evaluate((chip) => {
          const frame = chip.closest('[role="radiogroup"]')!.getBoundingClientRect();
          const box = chip.getBoundingClientRect();
          return box.left >= frame.left - 0.5 && box.right <= frame.right + 0.5;
        });
        expect(fullyVisible, `${label} ô cuối hiện trọn`).toBe(true);

        await expectNoHorizontalOverflow(page, label);
        expectNoSeriousIssues(guards, label);
      });
    }

    test("short sizes keep their square boxes", async ({ page, request }) => {
      await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
      await blockAnalytics(page);
      const guards = installPageGuards(page);
      const product = await loadProduct(request, SHORT_SIZE_SLUG, "vi");
      const label = `${SHORT_SIZE_SLUG} @${viewport.width}`;

      const picker = await openProduct(page, product, "vi");
      const group = picker.getByRole("radiogroup", { name: "Kích cỡ", exact: true });
      await expect(group.getByRole("radio").first()).toBeVisible();
      const row = await measureRow(group);
      expectTidyRow(row, label);
      for (const chip of row.chips.filter(({ text }) => text.trim().length <= 2)) {
        expect(chip.width, `${label} "${chip.text}" giữ ô vuông`).toBe(CHIP);
      }

      await expectNoHorizontalOverflow(page, label);
      expectNoSeriousIssues(guards, label);
    });

    for (const locale of ["vi", "en"] as const) {
      test(`cool-dry product exposes the approved part labels (${locale})`, async ({
        page,
        request,
      }) => {
        await installPreviewBackendCors(page, process.env.PW_BACKEND_ORIGIN);
        await blockAnalytics(page);
        const guards = installPageGuards(page);
        const product = await loadProduct(request, PARTS_SLUG, locale);
        const partName = locale === "en" ? "Part" : "Bo";
        const expectedValues =
          locale === "en" ? ["Top", "Set of 2", "Pants"] : ["Áo", "Dual", "Quần"];
        const partValues = Array.from(
          new Set(
            product
              .variants!.map(
                (variant) => variant.options?.find((option) => option.name === partName)?.value,
              )
              .filter((value): value is string => Boolean(value)),
          ),
        );
        expect(partValues).toEqual(expectedValues);

        const picker = await openProduct(page, product, locale);
        const group = picker.getByRole("radiogroup", { name: partName, exact: true });
        await expect(group.getByRole("radio")).toHaveCount(expectedValues.length);
        for (const value of expectedValues) {
          await expect(group.getByRole("radio", { name: value, exact: true })).toHaveAttribute(
            "value",
            value,
          );
        }
        await group.getByRole("radio", { name: expectedValues[1], exact: true }).click();
        await expect(
          group.getByRole("radio", { name: expectedValues[1], exact: true }),
        ).toHaveAttribute("aria-checked", "true");
        if (locale === "en") {
          await expect(group.getByRole("radio", { name: "Áo", exact: true })).toHaveCount(0);
          await expect(picker.getByText("Bo", { exact: true })).toHaveCount(0);
        }

        await expectNoHorizontalOverflow(page, `${PARTS_SLUG} ${locale} @${viewport.width}`);
        expectNoSeriousIssues(guards, `${PARTS_SLUG} ${locale} @${viewport.width}`);
      });
    }
  });
}
