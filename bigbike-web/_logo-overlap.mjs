// Quick diagnostic: at initial-load (no scroll), measure desktop logo
// bounding box and compare with breadcrumb / first body content on
// representative routes. Prints rectangles so we can spot vertical/horizontal
// overlap (logo overflows below the 80px fixed header).
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://103.1.236.148:3000";

const ROUTES = [
  { path: "/danh-muc-san-pham/ao-bao-ho-tui-khi/", name: "Category PLP" },
  { path: "/brands/alpinestars/", name: "Brand detail" },
  { path: "/tin-tuc/", name: "News listing" },
  { path: "/tin-tuc/cach-chon-balo-phuot/", name: "News article" },
  { path: "/bao-hanh/", name: "Bao hanh (static)" },
  { path: "/chinh-sach/doi-tra/", name: "Policy" },
  { path: "/lien-he/", name: "Lien he" },
  { path: "/huong-dan-mua-hang/", name: "Huong dan mua hang" },
  { path: "/gio-hang/", name: "Cart" },
  { path: "/tim-kiem/?q=ao", name: "Search results" },
  { path: "/dang-nhap/", name: "Login" },
  { path: "/tai-khoan/", name: "Account (likely redirect)" },
  { path: "/product/ao-giap-bao-ho-mua-he-ls2-garda-air/", name: "PDP" },
];

const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  console.log(`\n===== Viewport ${vp.name} =====`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  for (const r of ROUTES) {
    const url = BASE + r.path;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Wait for fonts/images to settle a beat. No scroll.
      await page.waitForTimeout(700);
      // Get header height var
      const data = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const header = document.querySelector(".bb-site-header");
        const logoImg = document.querySelector(".bb-logo .hide-mobile, .bb-logo-img");
        const logoLink = document.querySelector(".bb-logo > a");
        const breadcrumb =
          document.querySelector(".bb-breadcrumb") ||
          document.querySelector('nav[aria-label="Breadcrumb"]') ||
          document.querySelector('nav[aria-label="Điều hướng"]');
        const pageHead = document.querySelector(".bb-page-head");
        const main = document.querySelector(".bb-main") || document.querySelector("main");
        const hero = document.querySelector(".bb-cat-hero, [data-hero], .relative.h-\\[300px\\]");
        const headerScrolled = document.documentElement.hasAttribute("data-header-scrolled");
        function r(el) {
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom), right: Math.round(b.right) };
        }
        return {
          headerHeightVar: cs.getPropertyValue("--bb-header-height").trim(),
          headerScrolled,
          header: r(header),
          logoImg: r(logoImg),
          logoLink: r(logoLink),
          breadcrumb: r(breadcrumb),
          breadcrumbText: breadcrumb ? breadcrumb.textContent.trim().slice(0, 80) : null,
          pageHead: r(pageHead),
          main: r(main),
          hero: r(hero),
          location: location.pathname,
        };
      });

      console.log(`\n[${r.name}] ${data.location} (header-scrolled=${data.headerScrolled})`);
      console.log(`  header        ${JSON.stringify(data.header)}   --bb-header-height=${data.headerHeightVar}`);
      console.log(`  logoImg       ${JSON.stringify(data.logoImg)}`);
      console.log(`  logoLink      ${JSON.stringify(data.logoLink)}`);
      console.log(`  main.start    ${JSON.stringify(data.main)}`);
      console.log(`  breadcrumb    ${JSON.stringify(data.breadcrumb)}  text="${data.breadcrumbText ?? ""}"`);
      console.log(`  pageHead      ${JSON.stringify(data.pageHead)}`);
      console.log(`  hero          ${JSON.stringify(data.hero)}`);

      // Determine overlap of logo rect over breadcrumb rect (initial load, no scroll)
      function overlap(a, b) {
        if (!a || !b) return null;
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
        return { ox, oy, overlaps: ox > 0 && oy > 0 };
      }
      const ov = overlap(data.logoImg, data.breadcrumb);
      if (ov) {
        console.log(`  >> overlap(logoImg, breadcrumb): ${JSON.stringify(ov)} ${ov.overlaps ? "<<< COVERED" : ""}`);
      }
      const ov2 = overlap(data.logoImg, data.pageHead);
      if (ov2) {
        console.log(`  >> overlap(logoImg, pageHead):   ${JSON.stringify(ov2)} ${ov2.overlaps ? "<<< COVERED" : ""}`);
      }
    } catch (e) {
      console.log(`[${r.name}] ERROR: ${e.message}`);
    }
  }
  await ctx.close();
}

await browser.close();
