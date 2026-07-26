import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const page = await context.newPage();

  const BASE = 'http://localhost:5175';

  try {
    console.log('Navegando al landing...');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });

    // Esperar que el contenido cargue
    await page.waitForTimeout(2000);

    // Screenshot inicial (arriba)
    await page.screenshot({ path: path.join(__dirname, 'mobile-landing-top.png'), fullPage: false });
    console.log('OK: mobile-landing-top.png');

    // Scrollear hasta el pricing
    await page.evaluate(() => {
      const pricing = document.querySelector('.lp-pricing') || document.querySelector('[class*="pricing"]');
      if (pricing) pricing.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(__dirname, 'mobile-landing-pricing.png'), fullPage: false });
    console.log('OK: mobile-landing-pricing.png');

    // Full page screenshot
    await page.screenshot({ path: path.join(__dirname, 'mobile-landing-full.png'), fullPage: true });
    console.log('OK: mobile-landing-full.png');

    // Verificar que el CTA flotante existe
    const cta = await page.$('.lp-floating-cta');
    console.log(`Floating CTA: ${cta ? 'PRESENTE' : 'FALTANTE!'}`);

    // Verificar que la trust bar existe
    const trust = await page.$('.lp-trust-bar');
    console.log(`Trust Bar: ${trust ? 'PRESENTE' : 'FALTANTE!'}`);

    // Verificar que "Ver mas" está cerca del pricing
    const verMas = await page.$('.lp-mobile-more');
    console.log(`Ver mas: ${verMas ? 'PRESENTE' : 'FALTANTE!'}`);

    // Ver que no haya overflow horizontal
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasOverflow: doc.scrollWidth > doc.clientWidth + 2
      };
    });
    console.log(`Overflow horizontal: ${overflow.hasOverflow ? 'SI!' : 'NO'}`);

    // Contar secciones visibles en mobile
    const sections = await page.evaluate(() => {
      return document.querySelectorAll('.lp-section').length;
    });
    console.log(`Secciones visibles: ${sections}`);

    // Verificar textos no truncados raros
    const textIssues = await page.evaluate(() => {
      const issues = [];
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.overflow === 'hidden' && style.textOverflow === 'ellipsis' && el.textContent.length > 50) {
          // Solo reportar si el texto largo está cortado
        }
        if (style.fontSize && parseFloat(style.fontSize) < 9) {
          issues.push(`Texto muy chico (${style.fontSize}): ${el.textContent.substring(0, 30)}`);
        }
      });
      return issues;
    });
    if (textIssues.length > 0) {
      console.log('Problemas de texto:');
      textIssues.forEach(i => console.log(`  - ${i}`));
    } else {
      console.log('Textos: OK');
    }

    console.log('\n--- Test completado ---');
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
