#!/usr/bin/env node
/**
 * npm run check:og
 *
 * Checks the Open Graph image of every page in dist/ (block C; drawn after the build by
 * src/integrations/og.ts from the card each page hands to Base.astro). For each HTML page:
 *   - exactly one <meta property="og:image">, an absolute URL on the site's own origin, /og/...png
 *   - og:image:width 1200, og:image:height 630, an og:image:alt, twitter:card summary_large_image
 *     and a twitter:image equal to og:image
 *   - the file exists in dist/, is a PNG (signature and IHDR read from the bytes) of 1200 x 630,
 *     and is smaller than 300 KB
 * Also reports PNGs under dist/og/ that no page uses. Exits 1 on any problem.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.DIST ?? join(root, 'dist');
// The site's own origin, read back from the built home page's canonical URL (set from SITE.url in
// src/lib/site.ts), so the domain is written in one place only.
const SITE = new URL(readFileSync(join(dist, 'index.html'), 'utf8').match(/<link rel="canonical" href="([^"]+)"/)[1]).origin;
const MAX = 300 * 1024;
const problems = [];

const walk = (dir, ext) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });

const meta = (html, attr, name) =>
  [...html.matchAll(new RegExp(`<meta\\s+${attr}="${name.replace(/[.:]/g, '\\$&')}"\\s+content="([^"]*)"`, 'g'))].map((m) => m[1]);

/** Width and height from a PNG's IHDR chunk, or undefined when the bytes are not a PNG. */
function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return undefined;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const used = new Set();
const pages = walk(dist, '.html');
let largest = 0;
for (const p of pages) {
  const rel = relative(dist, p);
  const html = readFileSync(p, 'utf8');
  const images = meta(html, 'property', 'og:image');
  if (images.length !== 1) { problems.push(`${rel}: ${images.length} og:image tags`); continue; }
  const url = images[0];
  if (!url.startsWith(`${SITE}/og/`) || !url.endsWith('.png')) { problems.push(`${rel}: og:image ${url} is not ${SITE}/og/….png`); continue; }
  if (meta(html, 'property', 'og:image:width')[0] !== '1200') problems.push(`${rel}: og:image:width is not 1200`);
  if (meta(html, 'property', 'og:image:height')[0] !== '630') problems.push(`${rel}: og:image:height is not 630`);
  if (!meta(html, 'property', 'og:image:alt')[0]) problems.push(`${rel}: no og:image:alt`);
  if (meta(html, 'name', 'twitter:card')[0] !== 'summary_large_image') problems.push(`${rel}: twitter:card is not summary_large_image`);
  if (meta(html, 'name', 'twitter:image')[0] !== url) problems.push(`${rel}: twitter:image differs from og:image`);
  const file = join(dist, decodeURIComponent(url.slice(SITE.length)));
  used.add(file);
  if (!existsSync(file)) { problems.push(`${rel}: ${url} is not in dist/`); continue; }
  const buf = readFileSync(file);
  const size = pngSize(buf);
  if (!size) problems.push(`${rel}: ${relative(dist, file)} is not a PNG`);
  else if (size.width !== 1200 || size.height !== 630) problems.push(`${rel}: ${relative(dist, file)} is ${size.width} x ${size.height}, not 1200 x 630`);
  if (buf.length >= MAX) problems.push(`${rel}: ${relative(dist, file)} is ${(buf.length / 1024).toFixed(1)} KB, over 300 KB`);
  largest = Math.max(largest, buf.length);
}
const pngs = existsSync(join(dist, 'og')) ? walk(join(dist, 'og'), '.png') : [];
for (const f of pngs) if (!used.has(f)) problems.push(`${relative(dist, f)}: no page uses it`);

console.log(`${pages.length} pages, ${pngs.length} images, largest ${(largest / 1024).toFixed(1)} KB.`);
for (const p of problems) console.log(`  ${p}`);
console.log(`${problems.length} problems.`);
process.exit(problems.length ? 1 : 0);
