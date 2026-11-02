const { chromium } = require('playwright');
const path = require('path');
const products = require('./products.js');
const out = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  for (const [id, svg] of Object.entries(products)) {
    await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', '<svg width="1000" height="1000" ')}</body></html>`);
    await page.screenshot({ path: path.join(out, `${id}.jpg`), type: 'jpeg', quality: 82 });
  }
  await browser.close();
})();
