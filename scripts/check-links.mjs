#!/usr/bin/env node
/**
 * npm run check:links
 *
 * Walks every HTML file in dist/ and checks that each internal link, image, stylesheet, font and
 * anchor resolves inside dist/: `/path/` must be dist/path/index.html (or dist/path), `#id` must
 * exist in the target page, and no URL may point at another host (the site makes no external
 * requests; the only outside hrefs allowed are the canonical / Open Graph URLs on this site's own
 * domain, which are checked as internal paths). Also counts <script> tags (must be zero) and
 * reports pages with more or fewer than one <h1>. Exits 1 on any problem.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.DIST ?? join(root, 'dist');
// The site's own origin, read back from the built home page's canonical URL (set from SITE.url in
// src/lib/site.ts), so the domain is written in one place only.
const SITE = new URL(readFileSync(join(dist, 'index.html'), 'utf8').match(/<link rel="canonical" href="([^"]+)"/)[1]).origin;
const problems = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });

const pages = walk(dist);
const ids = new Map(); // file -> Set of ids
const html = new Map();
for (const p of pages) {
  const text = readFileSync(p, 'utf8');
  html.set(p, text);
  ids.set(p, new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

/** Resolve a site path to a file in dist. */
function fileFor(path) {
  const clean = decodeURIComponent(path.replace(/\?.*$/, ''));
  const candidates = [
    join(dist, clean),
    join(dist, clean, 'index.html'),
    join(dist, `${clean.replace(/\/$/, '')}.html`),
  ];
  for (const c of candidates) if (existsSync(c) && statSync(c).isFile()) return c;
  return undefined;
}

let scripts = 0;
for (const p of pages) {
  const text = html.get(p);
  const rel = relative(dist, p);
  scripts += (text.match(/<script\b/g) ?? []).length;
  const h1 = (text.match(/<h1\b/g) ?? []).length;
  if (h1 !== 1) problems.push(`${rel}: ${h1} <h1> elements`);

  const refs = [...text.matchAll(/\b(?:href|src|content)="([^"]+)"/g)].map((m) => m[1]);
  for (const raw of refs) {
    let url = raw.replace(/&amp;/g, '&');
    if (url.startsWith('mailto:') || url.startsWith('data:')) continue;
    if (/^[a-z]+:/i.test(url)) {
      if (url.startsWith(SITE)) url = url.slice(SITE.length) || '/';
      else if (/^https?:/.test(url)) {
        // Attribute values that are prose (meta content) are not URLs; only flag real hosts.
        problems.push(`${rel}: external URL ${url}`);
        continue;
      } else continue;
    }
    if (url.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(url)) continue; // theme-color values
    if (!url.startsWith('/') && !url.startsWith('#')) {
      // Relative or plain text in a content attribute: ignore unless it looks like a path.
      if (!/^\.{0,2}\//.test(url)) continue;
      url = join('/', dirname(rel), url);
    }
    const [path, hash] = url.split('#');
    const target = path ? fileFor(path) : p;
    if (!target) {
      // Non-page assets (fonts, images, feeds) must exist as files too.
      problems.push(`${rel}: broken link ${raw}`);
      continue;
    }
    if (hash && target.endsWith('.html') && !ids.get(target)?.has(hash)) {
      if (hash === 'main' && /id="main"/.test(readFileSync(target, 'utf8'))) continue;
      problems.push(`${rel}: missing anchor #${hash} in ${relative(dist, target)}`);
    }
  }
}

if (scripts) problems.push(`${scripts} <script> tag(s) in dist/`);

console.log(`${pages.length} pages checked.`);
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log('0 problems.');
