#!/usr/bin/env node
/**
 * npm run check:clean
 *
 * Enforces the clean repository rule (docs/PUBLISHING.md, "Clean repository rule"). Looks at:
 *   - every file Git would commit: `git ls-files --cached --others --exclude-standard` (tracked
 *     files plus new files that are not ignored), so it also works before the first commit;
 *   - every file in dist/, when a build exists;
 *   - the commit history, when there is one: author and committer names, addresses and dates
 *     (every date must be +0000) and every commit message.
 *
 * It reports:
 *   - generic patterns (PATTERNS below): home-directory paths, co-author trailers, assistant and
 *     vendor names, LAN addresses, .local host names, a private mail domain, the earlier domain and
 *     the commit the template was once taken from;
 *   - local patterns, one per line, from `.check-clean.local` (ignored by Git, never committed):
 *     the real names, addresses and host names this repository must not contain. Lines starting
 *     with # are comments. Matching ignores case and respects word edges, so a short name does not
 *     match inside a longer word;
 *   - PNG files carrying text, EXIF or time chunks (tEXt, iTXt, zTXt, eXIf, tIME);
 *   - SVG files carrying <metadata>, editor namespaces (inkscape, sodipodi, xmlns:dc) or comments
 *     that name a program;
 *   - PDF and JPEG files carrying author, producer, XMP or EXIF fields.
 *
 * A finding prints the file, the line and the name of the pattern, never the matched text, so the
 * output itself does not repeat a name. Exits 1 on any finding.
 *
 * Each pattern below has one letter in brackets ("Us[e]rs"): the regular expression still matches
 * the plain word, but this file does not contain the plain word, so it never reports itself.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Generic patterns: [name printed in a finding, regular expression]. */
const PATTERNS = [
  ['home path (macOS)', /\/Us[e]rs\//],
  ['home path (Linux)', /\/ho[m]e\/[A-Za-z0-9._-]+/],
  ['home path (Windows)', /C:\\+Us[e]rs/i],
  ['co-author trailer', /Co-Auth[o]red-By/i],
  ['generator line', /Gener[a]ted with/i],
  ['assistant name', /\bCl[a]ude\b|\bcl[a]ude\.(?:ai|com)\b/],
  ['vendor name', /Anthr[o]pic/i],
  ['vendor name', /Open[A]I/i],
  ['assistant name', /Chat[G]PT/i],
  ['assistant name', /Copi[l]ot/i],
  ['LAN address', /\b192\.16[8]\.\d{1,3}\.\d{1,3}\b/],
  ['LAN address', /\b10\.[0]\.\d{1,3}\.\d{1,3}\b/],
  ['.local host name', /(?<![A-Za-z0-9.-])(?!check-clean\.local\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.lo[c]al\b/],
  ['private mail domain', /@tu[t]a\b|\btu[t]anota\b/i],
  ['earlier domain', /termsapply\.o[r]g/i],
  ['source commit', /\bad8e63[5]/i],
];

/** Local patterns from .check-clean.local: literal text, any case, at word edges. */
const localFile = join(root, '.check-clean.local');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LOCAL = existsSync(localFile)
  ? readFileSync(localFile, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l, i) => [`local pattern ${i + 1}`, new RegExp(`(?<![A-Za-z0-9])${escape(l)}(?![A-Za-z0-9])`, 'i')])
  : [];

const ALL = [...PATTERNS, ...LOCAL];
const findings = [];

/** Text patterns, line by line. Binary files are read as Latin-1, so their embedded strings count too. */
function scanText(label, text) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const [name, re] of ALL) if (re.test(line)) findings.push(`${label}:${i + 1}: ${name}`);
  });
}

/** PNG chunk types in file order. */
function pngChunks(buf) {
  const sig = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== sig) return undefined;
  const out = [];
  for (let at = 8; at + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(at);
    out.push(buf.subarray(at + 4, at + 8).toString('latin1'));
    at += 12 + len;
  }
  return out;
}

const PNG_BAD = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
const SVG_BAD = [
  ['SVG <metadata>', /<metadata\b/i],
  ['SVG editor namespace', /inkscape|sodipodi|xmlns:dc\b|xmlns:cc\b|xmlns:rdf\b/i],
  ['SVG comment naming a program', /<!--[^]*?(?:generator|created with|inkscape|illustrator|sketch|figma|adobe|affinity|corel)[^]*?-->/i],
];
const PDF_BAD = [['PDF author or producer', /\/(?:Author|Producer|Creator)\s*\(/], ['PDF XMP metadata', /<x:xmpmeta/]];
const JPG_BAD = [['JPEG EXIF', /Exif\0\0/], ['JPEG XMP metadata', /http:\/\/ns\.adobe\.com\/xap/]];

function scanFile(abs, label) {
  const buf = readFileSync(abs);
  const latin = buf.toString('latin1');
  scanText(label, latin);
  const lower = abs.toLowerCase();
  if (lower.endsWith('.png')) {
    const chunks = pngChunks(buf);
    if (!chunks) findings.push(`${label}: not a PNG file`);
    else for (const c of new Set(chunks.filter((c) => PNG_BAD.has(c)))) findings.push(`${label}: PNG chunk ${c}`);
  } else if (lower.endsWith('.svg')) {
    for (const [name, re] of SVG_BAD) if (re.test(latin)) findings.push(`${label}: ${name}`);
  } else if (lower.endsWith('.pdf')) {
    for (const [name, re] of PDF_BAD) if (re.test(latin)) findings.push(`${label}: ${name}`);
  } else if (/\.jpe?g$/.test(lower)) {
    for (const [name, re] of JPG_BAD) if (re.test(latin)) findings.push(`${label}: ${name}`);
  }
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// 1. Files Git would commit.
let repoFiles = [];
try {
  repoFiles = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
} catch {
  console.error('check:clean: not a Git repository; checking dist/ only.');
}
for (const f of repoFiles) {
  const abs = join(root, f);
  if (existsSync(abs) && statSync(abs).isFile()) scanFile(abs, f);
}

// 2. The build.
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const built = existsSync(dist) ? walk(dist) : [];
for (const abs of built) scanFile(abs, relative(root, abs));

// 3. The history: names, addresses, dates and messages of every commit.
let commits = 0;
try {
  const log = git('log', '--all', '--format=%H%x1f%an%x1f%ae%x1f%ai%x1f%cn%x1f%ce%x1f%ci%x1f%B%x1e');
  for (const rec of log.split('\x1e').map((r) => r.trim()).filter(Boolean)) {
    const [hash, an, ae, ad, cn, ce, cd, body] = rec.split('\x1f');
    const id = `commit ${hash.slice(0, 7)}`;
    commits++;
    for (const [what, date] of [['author date', ad], ['committer date', cd]])
      if (!/\+0000$/.test(date.trim())) findings.push(`${id}: ${what} is not +0000`);
    scanText(`${id} author`, `${an} ${ae}`);
    scanText(`${id} committer`, `${cn} ${ce}`);
    scanText(`${id} message`, body ?? '');
  }
} catch {
  // No commits yet.
}

const scope = `${repoFiles.length} repository files, ${built.length} files in dist/, ${commits} commits, ${PATTERNS.length} generic and ${LOCAL.length} local patterns`;
if (findings.length) {
  console.log(findings.join('\n'));
  console.log(`\ncheck:clean: ${findings.length} problem(s) in ${scope}.`);
  process.exit(1);
}
console.log(`check:clean: 0 problems in ${scope}.`);
