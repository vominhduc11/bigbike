const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:3000';
const PRODUCT_LISTING_URLS = process.env.PRODUCT_LISTING_URLS || '';
const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/product-listing');

const DEFAULT_CANDIDATE_PATHS = [
  '/products',
  '/product',
  '/san-pham',
  '/danh-muc-san-pham',
  '/shop',
  '/category',
  '/collections',
];

function normalizeUrl(input) {
  try {
    return new URL(input, BASE_URL).toString();
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
      // Optional overlay. Ignore.
    }
  }
}

async function getUrlsFromEnv() {
  if (!PRODUCT_LISTING_URLS.trim()) {
    return [];
  }

  return unique(
    PRODUCT_LISTING_URLS
      .split(',')
      .map((item) => item.trim())
      .map(normalizeUrl)
  );
}

async function gotoWithNetworkIdleFallback(page, url, timeout = 30000) {
  try {
    return await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
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
      timeout,
    });

    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    return response;
  }
}

async function isLikelyProductListingPage(page) {
  const signals = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();

    const productCardSelectors = [
      '[class*="product-card"]',
      '[class*="ProductCard"]',
      '[data-testid*="product"]',
      '[class*="product-grid"]',
      '[class*="ProductGrid"]',
      '[class*="catalog"]',
      '[class*="shop"]',
    ];

    const productCardCount = productCardSelectors.reduce((count, selector) => {
      return count + document.querySelectorAll(selector).length;
    }, 0);

    const productLinks = Array.from(document.querySelectorAll('a[href]'))
      .map((anchor) => anchor.getAttribute('href') || '')
      .filter((href) =>
        /\/(products|product|san-pham|chi-tiet-san-pham)\/[^/?#]+\/?$/i.test(href)
      ).length;

    const keywordScore = [
      'sản phẩm',
      'products',
      'product',
      'danh mục',
      'catalog',
      'shop',
      'lọc',
      'filter',
      'sort',
      'sắp xếp',
    ].filter((keyword) => text.includes(keyword)).length;

    return {
      productCardCount,
      productLinks,
      keywordScore,
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
    };
  });

  return (
    signals.productCardCount >= 2 ||
    (signals.productLinks >= 3 && signals.keywordScore >= 2)
  );
}

async function discoverListingUrlsFromCandidatePaths(page) {
  const urls = [];

  for (const candidatePath of DEFAULT_CANDIDATE_PATHS) {
    const url = normalizeUrl(candidatePath);

    try {
      const response = await gotoWithNetworkIdleFallback(page, url, 30000);

      if (!response || !response.ok()) {
        continue;
      }

      await page.waitForTimeout(1000);

      if (await isLikelyProductListingPage(page)) {
        urls.push(url);
      }
    } catch {
      // Candidate route does not exist. Ignore.
    }
  }

  return unique(urls);
}

async function discoverListingUrlsFromLinks(page) {
  const foundUrls = [];

  const seedPaths = ['/', '/products', '/san-pham', '/shop'];

  for (const seedPath of seedPaths) {
    const seedUrl = normalizeUrl(seedPath);

    try {
      const response = await gotoWithNetworkIdleFallback(page, seedUrl, 30000);

      if (!response || !response.ok()) {
        continue;
      }

      await page.waitForTimeout(1000);

      const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute('href'))
          .filter(Boolean)
      );

      for (const href of hrefs) {
        const normalized = normalizeUrl(href);

        if (
          normalized &&
          /\/(products|product|san-pham|danh-muc-san-pham|shop|category|collections)(\/)?$/i.test(
            new URL(normalized).pathname
          )
        ) {
          foundUrls.push(normalized);
        }
      }
    } catch {
      // Missing seed route. Ignore.
    }
  }

  return unique(foundUrls);
}

async function discoverListingUrlsFromSitemap(page) {
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

    return unique(
      [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
        .map((match) => match[1].trim())
        .filter((url) =>
          /\/(products|product|san-pham|danh-muc-san-pham|shop|category|collections)(\/)?$/i.test(
            new URL(url).pathname
          )
        )
    );
  } catch {
    return [];
  }
}

async function discoverProductListingUrls(page) {
  const fromEnv = await getUrlsFromEnv();

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  const fromCandidatePaths = await discoverListingUrlsFromCandidatePaths(page);

  if (fromCandidatePaths.length > 0) {
    return fromCandidatePaths;
  }

  const fromLinks = await discoverListingUrlsFromLinks(page);

  if (fromLinks.length > 0) {
    return fromLinks;
  }

  const fromSitemap = await discoverListingUrlsFromSitemap(page);

  if (fromSitemap.length > 0) {
    return fromSitemap;
  }

  throw new Error(
    [
      'Không tìm thấy product listing page.',
      'Hãy kiểm tra lại route trong source hoặc truyền URL thủ công.',
      'Ví dụ:',
      'PRODUCT_LISTING_URLS="http://localhost:3000/san-pham" npm run screenshot:product-listing',
    ].join('\n')
  );
}

async function captureListingPage(page, url, index, total) {
  await gotoWithNetworkIdleFallback(page, url, 60000);

  await page.waitForTimeout(1500);
  await closeCommonOverlays(page);
  await autoScroll(page);
  await page.waitForTimeout(1000);

  const safeName = sanitizeFileName(url);
  const fileName =
    total === 1
      ? 'product-listing-full-desktop.png'
      : `${String(index + 1).padStart(2, '0')}-${safeName}.png`;

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
    const listingUrls = await discoverProductListingUrls(page);

    if (listingUrls.length === 0) {
      throw new Error('Danh sách product listing URLs rỗng.');
    }

    console.log(`Found ${listingUrls.length} product listing URL(s).`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    const results = [];

    for (let index = 0; index < listingUrls.length; index += 1) {
      const url = listingUrls[index];

      console.log(`[${index + 1}/${listingUrls.length}] Capturing: ${url}`);

      const outputFile = await captureListingPage(
        page,
        url,
        index,
        listingUrls.length
      );

      results.push(outputFile);
      console.log(`Saved: ${outputFile}`);
    }

    console.log('\nDone. Product listing screenshots exported:');

    for (const file of results) {
      console.log(`- ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to capture product listing screenshot.');
  console.error(error);
  process.exit(1);
});
