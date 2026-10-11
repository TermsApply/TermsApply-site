/**
 * The policy archive: every archived version of every document, read from the `policies`
 * collection, with the raw text loaded from src/content/policies/text/ and its SHA-256 computed at
 * build time. A checksum that does not match the entry's `sha256` fails the build, naming both files.
 *
 * Addresses (README, "Policy archive"):
 *   /archive/                                           every version, grouped by service
 *   /archive/<service>/                                 one service's documents and versions
 *   /archive/<service>/<documentSlug>/<version>/        one version: metadata and the text, in mono
 *   /archive/<service>/<documentSlug>/<version>/<text>  the raw .txt, byte for byte (text/plain)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

/** Where the raw texts live, relative to the project root (the build runs from there). */
const POLICY_TEXT_DIR = 'src/content/policies/text';

export interface ArchivedPolicy {
  entry: CollectionEntry<'policies'>;
  serviceId: string;
  serviceName: string;
  document: string;
  documentSlug: string;
  version: string;
  effective?: Date;
  retrieved: Date;
  sha256: string;
  sourceUrl?: string;
  /** File name of the raw text, as published next to the page. */
  textFile: string;
  /** The raw bytes, exactly as stored and served. */
  bytes: Buffer;
  text: string;
  words: number;
  /** /archive/<service>/<documentSlug>/<version>/ */
  href: string;
  /** /archive/<service>/<documentSlug>/<version>/<textFile> */
  txtHref: string;
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Newest first: by effective date, then retrieval date, then version number. */
export const byNewest = (a: ArchivedPolicy, b: ArchivedPolicy) =>
  (b.effective ?? b.retrieved).valueOf() - (a.effective ?? a.retrieved).valueOf() ||
  b.retrieved.valueOf() - a.retrieved.valueOf() ||
  b.version.localeCompare(a.version, 'en', { numeric: true });

let cache: Promise<ArchivedPolicy[]> | undefined;

/**
 * Every archived version, grouped by service name and document, newest first within a document.
 * Loaded and verified once per build.
 */
export function getPolicies(): Promise<ArchivedPolicy[]> {
  cache ??= load();
  return cache;
}

async function load(): Promise<ArchivedPolicy[]> {
  const entries = await getCollection('policies');
  const seen = new Map<string, string>();
  const out = await Promise.all(
    entries.map(async (entry) => {
      const d = entry.data;
      const where = `src/content/policies/${entry.id}.md`;
      const service = await getEntry(d.service);
      if (!service) throw new Error(`${where}: unknown service "${d.service.id}"`);
      const path = join(process.cwd(), POLICY_TEXT_DIR, d.text);
      if (!existsSync(path)) throw new Error(`${where}: text file ${POLICY_TEXT_DIR}/${d.text} does not exist`);
      const bytes = readFileSync(path);
      const actual = sha256(bytes);
      if (actual !== d.sha256) {
        throw new Error(
          `Policy archive: SHA-256 mismatch for ${POLICY_TEXT_DIR}/${d.text} (declared in ${where}).\n` +
            `  declared ${d.sha256}\n  actual   ${actual}\n` +
            'The archived text must not change. If this is a new file, run `npm run policy:sha` and copy the value.',
        );
      }
      const key = `${service.id}/${d.documentSlug}/${d.version}`;
      if (seen.has(key)) throw new Error(`${where}: ${key} is already archived in ${seen.get(key)}`);
      seen.set(key, where);
      const href = `/archive/${service.id}/${d.documentSlug}/${d.version}/`;
      const text = bytes.toString('utf8');
      return {
        entry,
        serviceId: service.id,
        serviceName: service.data.name,
        document: d.document,
        documentSlug: d.documentSlug,
        version: d.version,
        effective: d.effectiveDate,
        retrieved: d.retrievedAt,
        sha256: d.sha256,
        sourceUrl: d.sourceUrl,
        textFile: d.text,
        bytes,
        text,
        words: text.split(/\s+/).filter(Boolean).length,
        href,
        txtHref: `${href}${d.text}`,
      } satisfies ArchivedPolicy;
    }),
  );
  return out.sort(
    (a, b) => a.serviceName.localeCompare(b.serviceName) || a.document.localeCompare(b.document) || byNewest(a, b),
  );
}

/** Versions of one service's documents, in archive order. */
export async function policiesFor(serviceId: string) {
  return (await getPolicies()).filter((p) => p.serviceId === serviceId);
}

/** Group a list by service, then by document, keeping the order given. */
export function groupPolicies(list: ArchivedPolicy[]) {
  const services: { id: string; name: string; documents: { slug: string; name: string; versions: ArchivedPolicy[] }[] }[] = [];
  for (const p of list) {
    let s = services.find((x) => x.id === p.serviceId);
    if (!s) services.push((s = { id: p.serviceId, name: p.serviceName, documents: [] }));
    let doc = s.documents.find((x) => x.slug === p.documentSlug);
    if (!doc) s.documents.push((doc = { slug: p.documentSlug, name: p.document, versions: [] }));
    doc.versions.push(p);
  }
  return services;
}

/* ---------- The text, as blocks ---------- */

type PolicyBlock =
  | { kind: 'h'; level: 2 | 3; num: string; id: string; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'p'; lines: string[] };

/** Anchor of a numbered clause heading: "3.1" -> "s-3-1". */
const clauseAnchor = (num: string) => `s-${num.replace(/\.+$/, '').replace(/\./g, '-')}`;

/**
 * Split a plain-text policy into blocks for the page. Blank lines part blocks; single line breaks
 * inside a block are kept. A one-line block that starts with a clause number ("3.", "3.1") and does
 * not end like a sentence is a clause heading (h2 for "3.", h3 for "3.1"), anchored #s-3-1. Any
 * other short one-line block that does not end like a sentence (the document's own title) is set as
 * a title line. Nothing is reworded: every character of the file appears on the page.
 */
export function policyBlocks(text: string): PolicyBlock[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((b) => b.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map((lines): PolicyBlock => {
      const one = lines.length === 1 ? lines[0].trim() : undefined;
      const sentence = one ? /[.,;:!?)"”]$/.test(one) : true;
      const m = one?.match(/^(\d+(?:\.\d+)*)\.?\s+(\S.*)$/);
      if (one && m && !sentence && one.length <= 90) {
        const num = m[1];
        return { kind: 'h', level: num.includes('.') ? 3 : 2, num, id: clauseAnchor(num), text: one };
      }
      if (one && !sentence && one.length <= 80) return { kind: 'title', text: one };
      return { kind: 'p', lines };
    });
}

/**
 * The archive page for one version of a document, if it is on file, optionally at a clause
 * ("§3.1 “Your content”" -> #s-3-1, when the text has that heading). Used by Diff and the service
 * profile; returns undefined when the version is not archived, so
 * callers print a plain version label instead.
 */
export async function archiveHref(serviceId: string, document: string, version: string, clause?: string) {
  const p = (await getPolicies()).find(
    (x) => x.serviceId === serviceId && x.document.toLowerCase() === document.toLowerCase() && x.version === version,
  );
  if (!p) return undefined;
  const num = clause?.match(/§\s*(\d+(?:\.\d+)*)/)?.[1];
  const anchor = num ? clauseAnchor(num) : undefined;
  const has = anchor && policyBlocks(p.text).some((b) => b.kind === 'h' && b.id === anchor);
  return has ? `${p.href}#${anchor}` : p.href;
}

/** "7289a404…5c5200": the checksum shortened for list rows (the version page prints it in full). */
export const shortSha = (sha: string) => `${sha.slice(0, 8)}…${sha.slice(-6)}`;
