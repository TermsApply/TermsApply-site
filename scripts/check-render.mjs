#!/usr/bin/env node
/**
 * npm run check:render
 *
 * Serves dist/ on a local port and opens every HTML page in headless Chromium at 400 and 1280 px,
 * in light and dark colour schemes. For each render it requires:
 *   - document.documentElement.scrollWidth == viewport width (no horizontal scroll)
 *   - no console errors or warnings, no page errors, no failed requests
 *   - no request to another origin
 *   - exactly one <h1>
 * With SHOTS=<dir> it also saves a PNG per render (full page) for the visual audit.
 * With PAGES=<comma list of paths> it limits the run to those pages.
 * Needs a global Playwright, or PLAYWRIGHT_MODULE and CHROMIUM (README, "Stack").
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.DIST ?? join(root, 'dist');
const pwPath =
  process.env.PLAYWRIGHT_MODULE ??
  join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright');
const { chromium } = createRequire(import.meta.url)(pwPath);
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.jpg': 'image/jpeg',
};
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });
let pages = walk(dist).map((p) => '/' + relative(dist, p).replace(/index\.html$/, ''));
if (process.env.PAGES) pages = process.env.PAGES.split(',').map((s) => s.trim());

const browser = await chromium.launch({ executablePath });
const problems = [];
let renders = 0;
for (const scheme of ['light', 'dark']) {
  for (const width of [400, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`console ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
    page.on('request', (r) => { if (!r.url().startsWith(origin)) errors.push(`external request: ${r.url()}`); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
    for (const path of pages) {
      errors.length = 0;
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const { sw, cw, h1 } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        h1: document.querySelectorAll('h1').length,
      }));
      renders++;
      const tag = `${path} @${width} ${scheme}`;
      if (sw > cw) problems.push(`${tag}: scrollWidth ${sw} > viewport ${cw}`);
      if (h1 !== 1) problems.push(`${tag}: ${h1} h1`);
      for (const e of errors) problems.push(`${tag}: ${e}`);
      if (shots) {
        const name = (path === '/' ? 'index' : path.replace(/^\/|\/$/g, '').replace(/\.html$/, '').replace(/\//g, '-')) + `-${width}-${scheme}.png`;
        await page.screenshot({ path: join(shots, name), fullPage: true });
      }
    }
    await context.close();
  }
}
await browser.close();
server.close();

console.log(`${pages.length} pages, ${renders} renders.`);
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log('0 problems.');
