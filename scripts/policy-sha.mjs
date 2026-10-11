#!/usr/bin/env node
/**
 * npm run policy:sha [file ...]
 *
 * Prints the SHA-256 of each raw policy text in src/content/policies/text/ (or of the files
 * given), one per line as "<sha256>  <file>", the format of `sha256sum`, so an editor can copy the
 * value into the policy entry's `sha256` field. It also says, for each text, whether the entry that
 * names it declares the same checksum (the build fails when they differ).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const textDir = join(root, 'src', 'content', 'policies', 'text');
const entryDir = join(root, 'src', 'content', 'policies');

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(textDir).filter((f) => f.endsWith('.txt')).sort().map((f) => join(textDir, f));

// sha256 declared per text file name, read from the entries' front matter (two plain keys).
const declared = new Map();
for (const f of readdirSync(entryDir).filter((f) => f.endsWith('.md'))) {
  const fm = readFileSync(join(entryDir, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const text = fm.match(/^text:\s*['"]?([^'"\s]+)/m)?.[1];
  const sha = fm.match(/^sha256:\s*['"]?([0-9a-f]{64})/m)?.[1];
  if (text) declared.set(text, { sha, entry: f });
}

let mismatches = 0;
for (const file of files) {
  const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
  const d = declared.get(basename(file));
  const status = !d ? 'no entry names this file' : d.sha === sha ? `matches ${d.entry}` : `DIFFERS from ${d.entry} (${d.sha ?? 'none'})`;
  if (d && d.sha !== sha) mismatches++;
  console.log(`${sha}  ${basename(file)}  ${status}`);
}
process.exit(mismatches ? 1 : 0);
