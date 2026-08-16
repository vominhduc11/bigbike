const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:3000/sp/?min_price=1000000&max_price=4000000', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const read = async (tag) => {
    const v = await page.evaluate(() => {
      const f = document.querySelector("aside [data-price-filter='true']");
      return {
        inputs: [...f.querySelectorAll('input')].map(i => i.value),
        thumbs: [...f.querySelectorAll("[role='slider']")].map(t => t.getAttribute('aria-valuenow')),
        active: f.getAttribute('data-price-filter-active'),
        url: location.search,
      };
    });
    console.log(`${tag}: inputs=${JSON.stringify(v.inputs)} thumbs=${JSON.stringify(v.thumbs)} active=${v.active} url=${v.url}`);
  };
  await read('start          ');
  await page.getByRole('button', { name: /^Bỏ bộ lọc/ }).first().click();
  await page.waitForTimeout(2500);
  await read('after chip X   ');
  await b.close();
})();
