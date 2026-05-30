import { test } from "@playwright/test";

/**
 * Audit responsive của hero banner (.bb-main-banner) trên trang chủ.
 * Kiểm tra 6 hạng mục: AR ảnh desktop, thiếu ảnh mobile, AR ảnh mobile,
 * height container theo breakpoint, object-position, text overlay.
 *
 * Chạy:
 *   npx playwright test e2e/hero-banner-responsive-audit.spec.ts --reporter=list
 */
test("hero banner responsive audit", async ({ page }) => {
  test.setTimeout(120_000);

  const results: { level: string; message: string }[] = [];

  function log(level: "ERROR" | "WARN" | "INFO" | "PASS", message: string) {
    results.push({ level, message });
    console.log(`${`[${level}]`.padEnd(9)} ${message}`);
  }

  // ── Kiểm tra 1 + 2 + 3 + 5 + 6a: Desktop 1440×900 ──────────────────

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector(".bb-main-banner", { timeout: 20_000 });
  await page.waitForTimeout(2000); // Swiper init + images decode

  if (!(await page.locator(".bb-main-banner").count())) {
    log("ERROR", "Không tìm thấy .bb-main-banner trên trang — dừng audit");
    return;
  }

  console.log("\n── Desktop 1440×900 ──────────────────────────────────────────");

  const desktop = await page.evaluate(async () => {
    // Đợi tất cả ảnh banner tải xong
    await Promise.all(
      Array.from(
        document.querySelectorAll<HTMLImageElement>(".bb-main-banner-img")
      ).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      )
    );

    const container = document.querySelector<HTMLElement>(".bb-main-banner");

    // Loại bỏ slide cloned của Swiper (loop mode)
    const links = Array.from(
      document.querySelectorAll<HTMLElement>(".bb-main-banner-link")
    ).filter((el) => !el.closest(".swiper-slide-duplicate"));

    const slides = links.map((link, i) => {
      const img = link.querySelector<HTMLImageElement>("img.bb-main-banner-img");
      const picture = link.querySelector("picture");
      const source = picture?.querySelector<HTMLSourceElement>(
        'source[media="(max-width: 767px)"]'
      );
      return {
        index: i + 1,
        natW: img?.naturalWidth ?? 0,
        natH: img?.naturalHeight ?? 0,
        src: img?.src ?? "",
        mobileSrcSet: source?.srcset ?? null,
        objectPosition: img ? getComputedStyle(img).objectPosition : "N/A",
      };
    });

    const copyEl = document.querySelector<HTMLElement>(".bb-main-banner-copy");
    return {
      containerW: container?.offsetWidth ?? 0,
      containerH: container?.offsetHeight ?? 0,
      slides,
      copyDisplay: copyEl ? getComputedStyle(copyEl).display : null,
    };
  });

  const containerAR = desktop.containerW / (desktop.containerH || 1);
  console.log(
    `   container: ${desktop.containerW}×${desktop.containerH}px  AR=${containerAR.toFixed(2)}  slides: ${desktop.slides.length}`
  );

  // 1. Tỉ lệ ảnh desktop vs container
  for (const s of desktop.slides) {
    if (s.natW > 0 && s.natH > 0) {
      const ar = s.natW / s.natH;
      if (ar > containerAR + 0.2) {
        const crop = Math.round((1 - containerAR / ar) * 100);
        log(
          "WARN",
          `Slide ${s.index}: ảnh desktop AR=${ar.toFixed(2)} vs container AR=${containerAR.toFixed(2)} → crop ~${crop}% chiều dọc`
        );
      } else {
        log(
          "PASS",
          `Slide ${s.index}: ảnh desktop AR=${ar.toFixed(2)} ≈ container AR=${containerAR.toFixed(2)}`
        );
      }
    } else {
      log(
        "WARN",
        `Slide ${s.index}: không lấy được naturalWidth/Height cho "${s.src.split("/").pop()}" — ảnh chưa tải?`
      );
    }
  }

  // 2. Kiểm tra slide thiếu ảnh mobile
  for (const s of desktop.slides) {
    const file = s.src.split("/").pop() ?? s.src;
    if (!s.mobileSrcSet) {
      log("ERROR", `Slide ${s.index}: THIẾU ảnh mobile version (desktop: ${file})`);
    } else {
      log("PASS", `Slide ${s.index}: có ảnh mobile source`);
    }
  }

  // 3. Tỉ lệ ảnh mobile
  for (const s of desktop.slides) {
    if (!s.mobileSrcSet) continue;
    // srcset có thể dạng "url.jpg" hoặc "url.jpg 1x, url@2x.jpg 2x"
    const mobileSrc = s.mobileSrcSet.trim().split(/\s+/)[0];
    const ar: number = await page.evaluate(
      (src: string) =>
        new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
          img.onerror = () => resolve(-1);
          img.src = src;
        }),
      mobileSrc
    );
    const file = mobileSrc.split("/").pop() ?? mobileSrc;
    if (ar < 0) {
      log("WARN", `Slide ${s.index}: không tải được ảnh mobile "${file}"`);
    } else if (ar > 1.5) {
      log(
        "WARN",
        `Slide ${s.index}: ảnh mobile vẫn nằm ngang (AR=${ar.toFixed(2)}), sẽ bị crop nhiều ở viewport dọc`
      );
    } else {
      const label =
        ar <= 1 ? "portrait ✓" : ar <= 1.2 ? "gần vuông" : "hơi ngang";
      log("PASS", `Slide ${s.index}: ảnh mobile AR=${ar.toFixed(2)} (${label})`);
    }
  }

  // 5. object-position
  const centerValues = ["50% 50%", "center", "center center"];
  const allCenter = desktop.slides.every((s) =>
    centerValues.includes(s.objectPosition.toLowerCase())
  );
  if (allCenter) {
    log(
      "INFO",
      "Tất cả slides dùng object-position mặc định (center center). Cân nhắc chỉnh per-slide nếu chủ thể lệch tâm."
    );
  } else {
    for (const s of desktop.slides) {
      log("INFO", `Slide ${s.index}: object-position = ${s.objectPosition}`);
    }
  }

  // 6a. Text overlay — desktop
  if (desktop.copyDisplay === null) {
    log("WARN", "Không tìm thấy .bb-main-banner-copy trong DOM");
  } else if (desktop.copyDisplay === "none") {
    log("INFO", "Text overlay ẩn trên desktop — text được baked vào ảnh");
  } else {
    log("INFO", `Text overlay desktop: display=${desktop.copyDisplay}`);
  }

  // ── Kiểm tra 4 + 6b: Mobile 390×844 ─────────────────────────────────

  console.log("\n── Mobile 390×844 ────────────────────────────────────────────");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const mobile = await page.evaluate(() => {
    const banner = document.querySelector<HTMLElement>(".bb-main-banner");
    const copyEl = document.querySelector<HTMLElement>(".bb-main-banner-copy");
    const copyRect = copyEl?.getBoundingClientRect();
    return {
      bannerH: banner?.offsetHeight ?? 0,
      copy: copyEl
        ? {
            display: getComputedStyle(copyEl).display,
            left: copyRect?.left ?? 0,
          }
        : null,
    };
  });

  if (mobile.bannerH < 250) {
    log(
      "ERROR",
      `Banner quá thấp ở mobile: ${mobile.bannerH}px (ngưỡng tối thiểu: 250px)`
    );
  } else if (mobile.bannerH < 300) {
    log(
      "WARN",
      `Banner hơi thấp ở mobile: ${mobile.bannerH}px (khuyến nghị ≥300px)`
    );
  } else {
    log("PASS", `Banner height ở mobile: ${mobile.bannerH}px ✓`);
  }

  if (!mobile.copy) {
    log("WARN", "Không tìm thấy .bb-main-banner-copy ở mobile");
  } else if (mobile.copy.display === "none") {
    log("INFO", "Text overlay ẩn ở mobile (display:none)");
  } else if (mobile.copy.left < 0) {
    log(
      "WARN",
      `Text overlay bị cắt ở mobile: left=${Math.round(mobile.copy.left)}px`
    );
  } else {
    log("PASS", "Text overlay visible ở mobile");
  }

  // ── Kiểm tra 4 continued: Tablet 768×1024 ────────────────────────────

  console.log("\n── Tablet 768×1024 ───────────────────────────────────────────");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/", { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const tablet = await page.evaluate(() => {
    const banner = document.querySelector<HTMLElement>(".bb-main-banner");
    const img = document.querySelector<HTMLImageElement>("img.bb-main-banner-img");
    return {
      bannerH: banner?.offsetHeight ?? 0,
      bannerW: banner?.offsetWidth ?? 0,
      currentSrc: img?.currentSrc ?? "",
      src: img?.src ?? "",
    };
  });

  log(
    "INFO",
    `Tablet banner: ${tablet.bannerW}×${tablet.bannerH}px  AR=${(
      tablet.bannerW / (tablet.bannerH || 1)
    ).toFixed(2)}`
  );

  if (tablet.currentSrc && tablet.currentSrc !== tablet.src) {
    log(
      "PASS",
      `Tablet dùng ảnh riêng: ${tablet.currentSrc.split("/").pop()}`
    );
  } else {
    log(
      "WARN",
      "Tablet dùng ảnh desktop (không có ảnh tối ưu cho màn hình trung)"
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────

  const counts: Record<string, number> = {
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    PASS: 0,
  };
  for (const r of results) counts[r.level] = (counts[r.level] ?? 0) + 1;

  console.log(
    "\n─────────────────────────────────────────────────────────────"
  );
  console.log(
    `SUMMARY: ${counts.ERROR} ERROR  ${counts.WARN} WARN  ${counts.INFO} INFO  ${counts.PASS} PASS`
  );
  console.log(
    "─────────────────────────────────────────────────────────────\n"
  );

  if (counts.ERROR > 0) {
    throw new Error(
      `Audit hoàn tất với ${counts.ERROR} lỗi nghiêm trọng — xem output bên trên`
    );
  }
});
