const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:3000';
const PRODUCT_DETAIL_URLS = process.env.PRODUCT_DETAIL_URLS || '';
const LIMIT = Number(process.env.PRODUCT_SCREENSHOT_LIMIT ?? 30);

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/product-details');

function normalizeUrl(url) {
  try {
    return new URL(url, BASE_URL).toString();
  } catch {
    return null;
  }
}

function sanitizeFileName(input) {
  return input
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isProductDetailUrl(url) {
  try {
    const { pathname } = new URL(url, BASE_URL);
    return /^\/(products|product|san-pham|chi-tiet-san-pham)\/[^/?#]+\/?$/i.test(
      pathname
    );
  } catch {
    return false;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 600;

      const timer = setInterval(() => {
        const scrollHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );

        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
  });
}

async function closeCommonOverlays(page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Đồng ý")',
    'button:has-text("Chấp nhận")',
    'button:has-text("Đóng")',
    'button:has-text("Close")',
    '[aria-label="close"]',
    '[aria-label="Close"]',
    '.close',
    '.popup-close',
    '.modal-close',
    '.chat-close',
  ];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 500 })) {
        await locator.click({ timeout: 1000 });
        await page.waitForTimeout(300);
      }
    } catch {
      // Optional overlay, ignore.
    }
  }
}

async function gotoWithNetworkIdleFallback(page, url) {
  try {
    return await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
  } catch (error) {
    if (error.name !== 'TimeoutError') {
      throw error;
    }

    console.warn(
      `Network idle timeout for ${url}. Falling back to load-state capture.`
    );

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    return response;
  }
}

async function getUrlsFromEnv() {
  if (!PRODUCT_DETAIL_URLS.trim()) {
    return [];
  }

  return unique(
    PRODUCT_DETAIL_URLS
      .split(',')
      .map((item) => item.trim())
      .map(normalizeUrl)
  );
}

async function getUrlsFromSitemap(page) {
  const sitemapUrl = normalizeUrl('/sitemap.xml');

  try {
    const response = await page.goto(sitemapUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    if (!response || !response.ok()) {
      return [];
    }

    const xml = await page.textContent('body');
    if (!xml) {
      return [];
    }

    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map((match) => match[1])
      .map((url) => url.trim())
      .filter(isProductDetailUrl);

    return unique(urls);
  } catch {
    return [];
  }
}

async function getUrlsFromPageLinks(page) {
  const candidatePaths = ['/', '/products', '/product', '/san-pham'];

  const foundUrls = [];

  for (const candidatePath of candidatePaths) {
    const url = normalizeUrl(candidatePath);

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      await autoScroll(page);
      await page.waitForTimeout(800);

      const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute('href'))
          .filter(Boolean)
      );

      for (const href of hrefs) {
        const normalized = normalizeUrl(href);

        if (
          normalized &&
          isProductDetailUrl(normalized)
        ) {
          foundUrls.push(normalized);
        }
      }
    } catch {
      // Ignore missing listing routes.
    }
  }

  return unique(foundUrls);
}

async function getUrlsFromStaticData() {
  const candidateFiles = [
    'bigbike-web/lib/mock/products.ts',
    'bigbike-web/lib/mock/products.js',
    'bigbike-web/content/products.json',
  ];

  const foundUrls = [];

  for (const candidateFile of candidateFiles) {
    const filePath = path.resolve(process.cwd(), candidateFile);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const slugMatches = [...content.matchAll(/slug:\s*["']([^"']+)["']/g)];

      for (const match of slugMatches) {
        const url = normalizeUrl(`/product/${match[1]}/`);
        if (url && isProductDetailUrl(url)) {
          foundUrls.push(url);
        }
      }
    } catch {
      // Ignore unreadable static-data files.
    }
  }

  return unique(foundUrls);
}

async function discoverProductDetailUrls(page) {
  const fromEnv = await getUrlsFromEnv();
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  const fromSitemap = await getUrlsFromSitemap(page);
  if (fromSitemap.length > 0) {
    return fromSitemap;
  }

  const fromLinks = await getUrlsFromPageLinks(page);
  if (fromLinks.length > 0) {
    return fromLinks;
  }

  const fromStaticData = await getUrlsFromStaticData();
  if (fromStaticData.length > 0) {
    return fromStaticData;
  }

  throw new Error(
    [
      'Không tìm được product detail URL nào.',
      'Hãy truyền URL thủ công bằng env PRODUCT_DETAIL_URLS.',
      'Ví dụ:',
      'PRODUCT_DETAIL_URLS="http://localhost:3000/products/demo-product" npm run screenshot:product-details',
    ].join('\n')
  );
}

async function captureProductPage(page, url, index) {
  await gotoWithNetworkIdleFallback(page, url);

  await page.waitForTimeout(1500);
  await closeCommonOverlays(page);
  await autoScroll(page);
  await page.waitForTimeout(1000);

  const safeName = sanitizeFileName(url);
  const fileName = `${String(index + 1).padStart(2, '0')}-${safeName}.png`;
  const outputFile = path.join(OUTPUT_DIR, fileName);

  await page.screenshot({
    path: outputFile,
    fullPage: true,
    type: 'png',
    animations: 'disabled',
    caret: 'hide',
  });

  return outputFile;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  try {
    const discoveredUrls = await discoverProductDetailUrls(page);

    const targetUrls =
      LIMIT === 0 ? discoveredUrls : discoveredUrls.slice(0, LIMIT);

    if (targetUrls.length === 0) {
      throw new Error('Danh sách product detail URLs rỗng.');
    }

    console.log(`Found ${discoveredUrls.length} product detail URL(s).`);
    console.log(`Capturing ${targetUrls.length} page(s).`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    const results = [];

    for (let index = 0; index < targetUrls.length; index += 1) {
      const url = targetUrls[index];
      console.log(`[${index + 1}/${targetUrls.length}] Capturing: ${url}`);

      const outputFile = await captureProductPage(page, url, index);
      results.push(outputFile);

      console.log(`Saved: ${outputFile}`);
    }

    console.log('\nDone. Product detail screenshots exported:');
    for (const file of results) {
      console.log(`- ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to capture product detail screenshots.');
  console.error(error);
  process.exit(1);
});
