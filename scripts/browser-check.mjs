import puppeteer from 'puppeteer';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.json': 'application/json' };
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, pipe: true, timeout: 20000, args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) { await request.continue(); return; }
    const file = path.resolve(root, decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1)));
    if (url.hostname !== 'powerconnex.test' || !file.startsWith(root)) { await request.abort(); return; }
    try { await request.respond({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: await readFile(file) }); }
    catch { await request.respond({ status: 404, body: 'Not found' }); }
  });
  await page.goto('http://powerconnex.test/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__explorer?.isReady(), { timeout: 45000 });
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, 'desktop.png') });
  assert.equal(await page.$eval('#loading', element => element.hidden), true);
  assert.equal(await page.evaluate(() => window.__explorer.getState().count), 57);
  assert.equal(await page.evaluate(() => window.__explorer.getState().meshCount), 77);
  assert.equal(await page.$$eval('[data-part*="PowerConnex_Logo"], [data-part*="Marking_"]', elements => elements.length), 0);

  await page.click('#assemble-button');
  await page.waitForFunction(() => window.__explorer.getState().explosion === 0);
  assert.ok(await page.evaluate(() => window.__explorer.getState().parts.every(p => p.position.every((v, i) => Math.abs(v - p.assembled[i]) < 1e-7))));
  assert.equal(await page.$eval('#move-button', element => element.disabled), true);
  await page.screenshot({ path: path.join(artifacts, 'assembled.png') });
  await page.click('#explode-button');
  await page.waitForFunction(() => window.__explorer.getState().explosion === 1);
  assert.ok(await page.evaluate(() => window.__explorer.getState().parts.every(p => p.position.every((v, i) => Math.abs(v - p.exploded[i]) < 1e-7))));

  await page.type('#part-search', 'สปริง');
  assert.equal(await page.$$eval('.part-select', elements => elements.length), 4);
  await page.click('[data-part="Outlet_01_Industrial_Spring"]');
  assert.equal(await page.evaluate(() => window.__explorer.getState().selected), 'Outlet_01_Industrial_Spring');
  await page.click('#isolate-button');
  assert.equal(await page.evaluate(() => window.__explorer.getState().visible), 1);
  await page.click('#move-button');
  assert.equal(await page.evaluate(() => window.__explorer.getState().moving), true);
  await page.click('#restore-part-button');
  assert.equal(await page.evaluate(() => window.__explorer.getState().moving), false);
  await page.click('#show-all-button');
  assert.equal(await page.evaluate(() => window.__explorer.getState().visible), 57);
  await page.click('#hide-button');
  assert.equal(await page.evaluate(() => window.__explorer.getState().visible), 56);
  await page.click('#show-all-button');
  await page.click('#reset-button');
  await page.waitForTimeout(900);

  const point = await page.evaluate(() => window.__explorer.project('Outlet_01_Faceplate', [0, .0016, 0]));
  await page.mouse.click(point.x, point.y);
  assert.equal(await page.evaluate(() => window.__explorer.getState().selected), 'Outlet_01_Faceplate');
  // A click on the actual decal must resolve the same faceplate owner.
  const logoPoint = await page.evaluate(() => window.__explorer.project('Outlet_01_PowerConnex_Logo'));
  await page.mouse.click(logoPoint.x, logoPoint.y);
  assert.equal(await page.evaluate(() => window.__explorer.getState().selected), 'Outlet_01_Faceplate');
  await page.click('#focus-button');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifacts, 'selected-part.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__explorer.getState().selected), null);
  await page.click('#rotate-button');
  assert.equal(await page.evaluate(() => window.__explorer.getState().autoRotate), true);
  await page.click('#rotate-button');
  await page.click('[data-view="top"]');
  assert.equal(await page.$eval('[data-view="top"]', el => el.getAttribute('aria-pressed')), 'true');

  await page.click('#references-button');
  assert.equal(await page.$eval('#references-dialog', el => el.open), true);
  assert.equal(await page.$$eval('.reference-grid img', images => images.length), 3);
  await page.keyboard.press('Escape');
  await page.click('#help-button');
  assert.equal(await page.$eval('#help-dialog', el => el.open), true);
  await page.keyboard.press('Escape');
  await page.click('#reset-button');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.waitForTimeout(800);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
  await page.click('#mobile-panel-button');
  assert.equal(await page.$eval('#inspector', el => el.classList.contains('collapsed')), true);
  await page.click('#mobile-panel-button');
  await page.type('#part-search', 'ทองแดง');
  assert.equal(await page.$$eval('.part-select', elements => elements.length), 3);
  assert.deepEqual(errors, []);
  console.log('PASS: model load; 57 logical parts / 77 meshes; assembled geometry; attached decal picking; pose endpoints; search; isolation; hide/show; move controls; camera; dialogs; responsive layout.');
} catch (error) { console.error('Browser checks failed:', error.stack); process.exitCode = 1; }
finally { if (browser) await browser.close(); }
