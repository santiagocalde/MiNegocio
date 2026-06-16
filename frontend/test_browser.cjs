const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => {
    localStorage.setItem('minegocio_token', 'test-token');
    localStorage.setItem('minegocio_plan', 'trial');
    localStorage.setItem('minegocio_user', JSON.stringify({id: '1'}));
  });
  
  await page.goto('http://localhost:5173/panel/compras');
  
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
})();
