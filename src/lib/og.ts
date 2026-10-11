/**
 * Open Graph cards (block C): one 1200 x 630 PNG per page, drawn at build time as the facing pages
 * of the site, so a link shared elsewhere carries the pair: their sentence on the left in mono, ours
 * on the right in serif, the asterisk in the gutter, the file bar and the wordmark at the foot.
 *
 * One source of truth: every page hands its card to Base (`og` and `fileRef` props, next to `title`
 * and `description`). Base turns it into the meta tags and, during `astro build` only, records the
 * card as a small JSON file in Astro's cache folder (recordCard below). After the build the
 * integration in src/integrations/og.ts renders each recorded card to dist/og/<route>.png. Nothing
 * is written in dev or by `astro check`, nothing reaches readers but the PNG and the meta tags, and
 * `npm run check:og` fails when a page has no image, or an image is not a 1200 x 630 PNG under 300 KB.
 *
 * Route to file (ogImagePath): the page's path without its slashes, ".png" appended, under /og/:
 *   /                                         -> /og/index.png
 *   /publications/                          -> /og/publications.png
 *   /publications/quill-notes-drafts/       -> /og/publications/quill-notes-drafts.png
 *   /publications/quill-notes-drafts/evidence/ -> /og/publications/quill-notes-drafts/evidence.png
 *   /404 (or /404.html)                       -> /og/404.png
 * A page's file and the folder of the pages under it never share a name, so nothing collides.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * What a page passes to Base as `og`. Every field is optional; Base fills the rest.
 * Two kinds of card (round 5):
 *   - a pair: their sentence (`verso`) facing ours (`recto`), under the page's own pair labels
 *     (`versoLabel` / `rectoLabel`: "Declared" / "Observed", "The policy says" / "What it means"),
 *     with the source line (`source`) under the quote in sentence case;
 *   - a plain card (`plain`): the section name (`versoLabel`) alone on the left as structure, set
 *     like the file bar; on the right, under "This site", the page name (`verso`) as a serif
 *     headline above the description (`recto`). No asterisk.
 */
export interface OgInput {
  /**
   * Their words for the left page, mono. Pass quotes when it is a quote: `"All notes are …"`. On a
   * plain card: the page name, set on the right page in serif ("How to reach us").
   */
  verso?: string;
  /**
   * The left label: on a pair, the page's own left label ("Declared"); on a plain card, the section
   * name ("How to read"), which is the whole of the left page.
   */
  versoLabel?: string;
  /** A pair's source line under the quote, sentence case: "Quill Notes Privacy Policy v4.2, §3.1". */
  source?: string;
  /** Our words for the right page, serif: the headline, the observation, the meaning; on a plain card, the description. */
  recto?: string;
  /** The page's own right label: "Observed", "What it means". A plain card always says "This site". */
  rectoLabel?: string;
  /** Draw the asterisk in the gutter (default true). Off where the page accuses no one (archive, topics). */
  mark?: boolean;
  /**
   * A plain card: the left page is structure (a section name), not a sentence of theirs; the alt
   * text then says "Left: <section>. Right: <page name>. <description>" instead of "their words"
   * (ogAlt), and the card is drawn as described above. Defaults to true when `verso` is not a quote
   * (does not start with `"`); pass false for their words set without quotation marks (an archived
   * document's title line) and for a composite in their voice (the 404).
   */
  plain?: boolean;
}

/** The card as recorded for the renderer. */
export interface OgCard extends Required<Pick<OgInput, 'verso' | 'recto' | 'mark' | 'plain'>> {
  versoLabel?: string;
  source?: string;
  rectoLabel?: string;
  /** The file bar's left-hand text: "FILE 0042 / REV 2026-09-14", "DICTIONARY / 12 ENTRIES". */
  bar: string;
  /** The page's path, for the error messages of the renderer. */
  page: string;
  /** Site path of the PNG, from ogImagePath(). */
  image: string;
  /** The alt text, also printed as og:image:alt. */
  alt: string;
}

/** The PNG's site path for a page path (see the table in the header). */
export function ogImagePath(pathname: string) {
  const route = pathname.replace(/\.html$/, '').replace(/^\/+|\/+$/g, '');
  return `/og/${route || 'index'}.png`;
}

/** A phrase closed as a sentence, unless it already ends in a full stop, a question or an exclamation. */
const closed = (s: string) => (/[.!?]["”]?$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** A card is plain unless its left page is a quote, or the page says otherwise. */
export const ogPlain = (verso: string, plain?: boolean) => plain ?? !verso.trim().startsWith('"');

/**
 * The alt text of a card: says what the picture shows, in words a screen reader can follow. A card
 * with their sentence on the left says so ("Left, their words: …"); a plain card names the section
 * on the left, then the page name and the description on the right, and never calls them theirs.
 */
export const ogAlt = (verso: string, recto: string, opts: { plain?: boolean; versoLabel?: string } = {}) => {
  if (!ogPlain(verso, opts.plain)) return `Facing pages. Left, their words: ${verso} Right, ours: ${recto}`;
  const name = opts.versoLabel ? `${closed(verso)} ` : '';
  return `termsapply card. Left: ${closed(opts.versoLabel ?? verso)} Right: ${name}${closed(recto)}`;
};

/**
 * Record a card for the renderer. Only does anything when the og integration has set
 * TERMSAPPLY_OG_CARDS, which it does for `astro build` only.
 */
export function recordCard(card: OgCard) {
  const dir = process.env.TERMSAPPLY_OG_CARDS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${encodeURIComponent(card.image)}.json`), JSON.stringify(card));
}
