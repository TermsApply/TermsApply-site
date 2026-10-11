/**
 * termsapply-og: renders the Open Graph card of every page (block C) after `astro build`.
 *
 * How it fits together (src/lib/og.ts has the route-to-file table):
 *   1. astro:config:setup (build only) points TERMSAPPLY_OG_CARDS at a fresh folder in Astro's
 *      cache (node_modules/.astro/og-cards/).
 *   2. While pages render, Base.astro records each page's card there (recordCard): their sentence,
 *      ours, the labels, the file bar, the image path. The page is the one source of the card.
 *   3. astro:build:done draws each card with satori (layout to SVG) and @resvg/resvg-js (SVG to PNG)
 *      and writes dist/og/<route>.png. Nothing is written to public/ and nothing generated is
 *      committed. `npm run check:og` then checks every page against its image.
 *
 * The card is the site's facing pages on paper (light only: an image has no colour scheme): their
 * words in IBM Plex Mono on the left page, the red six-arm asterisk in the gutter (drawn from
 * design/logo/asterisk.svg, never a typed "*"), our words in Literata on the right page, and the
 * file bar at the foot under a double rule, with the wordmark (design/logo/wordmark-inline.svg)
 * on the right. Two layouts (round 5):
 *   - a pair: the page's own labels over both pages (uppercase, tracked), the quote with its source
 *     line under it in sentence case, our sentence facing it; the asterisk sits at the vertical
 *     centre of the taller page (label to last line), never outside the page area;
 *   - a plain card (`plain`): the section name alone on the left, as structure, set like the file
 *     bar (Plex Mono SemiBold, uppercase, tracked, about 28 px, ink), never at quote size; on the
 *     right, under "THIS SITE", the page name as a Literata 600 headline above the description
 *     (Literata 400, ink-2). No asterisk. Fonts: scripts/og-fonts/ (WOFF, which satori reads; it cannot read WOFF2).
 * Colours are the light tokens of src/styles/global.css, repeated here because a PNG cannot read CSS.
 *
 * Fitting: a sentence is trimmed to about 28 words (the pages already pass about 20), then the
 * largest type size is chosen at which it fits its page, by counting lines the way the text will
 * wrap (Plex Mono is 0.6 em per character exactly; Literata is estimated at 0.54 em, wider than
 * its real average, so the estimate errs towards a smaller size and never overflows).
 */
import type { AstroIntegration } from 'astro';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { OgCard } from '../lib/og';
import { OG_HEIGHT as H, OG_WIDTH as W } from '../lib/og';

const C = { paper: '#F0E9DA', ink: '#16140F', ink2: '#5B5648', rule: '#CFC6B2', red: '#B2271D' };

/* Geometry, in px of the 1200 x 630 card. */
const PAD_X = 64;
const PAGE_W = 488; // each page; the gutter takes the rest of the 1072 px measure
const GUTTER = W - 2 * PAD_X - 2 * PAGE_W; // 96
const TEXT_H = 368; // room for the sentences under their labels
const PAGE_H = 472; // the two pages' area, from the top padding to the file bar's margin
const LABEL_H = 44; // a label row: 22 px of type and 22 px under it
const AST = 44;
const AST_BOX = AST + 24; // the asterisk with its 12 px of paper above and below

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, ...(children !== undefined ? { children } : {}), ...extra },
});

/** About `max` words, cut at a word, trailing punctuation dropped before the ellipsis (as trimWords in format.ts). */
function trimWords(text: string, max: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= max + 2) return text.trim();
  const cut = words.slice(0, max).join(' ').replace(/[,;:.]+$/, '');
  return /^"/.test(text.trim()) ? `${cut}…"` : `${cut}…`;
}

/** Lines a greedy word wrap takes at `cpl` characters per line (a word longer than a line counts its pieces). */
function lineCount(text: string, cpl: number) {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/)) {
    const len = word.length;
    if (used === 0) {
      lines += Math.ceil(len / cpl) - 1;
      used = len % cpl || cpl;
    } else if (used + 1 + len <= cpl) {
      used += 1 + len;
    } else {
      lines += Math.ceil(len / cpl);
      used = len % cpl || cpl;
    }
  }
  return lines;
}

/**
 * The largest size from `sizes` at which `text` fits `PAGE_W` x `maxH` with every word whole, and
 * the height it then takes. `whole` is false when even the smallest size cannot hold the longest
 * word on one line: the sentence is then set to break inside words rather than run off the card.
 */
function fit(text: string, sizes: number[], em: number, lh: number, maxH = TEXT_H) {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length));
  for (const fs of sizes) {
    const cpl = Math.floor(PAGE_W / (em * fs));
    const height = lineCount(text, cpl) * fs * lh;
    if (longest <= cpl && height <= maxH) return { fs, whole: true, height };
  }
  const fs = sizes.at(-1)!;
  return { fs, whole: false, height: lineCount(text, Math.floor(PAGE_W / (em * fs))) * fs * lh };
}

/** Cut a one-line mono label to the page width. */
const fitLabel = (s: string, fs: number) => {
  const cpl = Math.floor(PAGE_W / (0.6 * fs + 0.8));
  return s.length <= cpl ? s : `${s.slice(0, cpl - 1).trimEnd()}…`;
};

/**
 * Hyphenated compounds never break across lines (the site's NoBreak rule). Mono: the hyphen becomes
 * Plex Mono's own non-breaking hyphen (U+2011). Serif: Literata has no U+2011, so the sentence is
 * set as a wrapping row of words, each word one unbreakable item, a word space apart.
 */
const monoNoBreak = (s: string) => s.replace(/(?<=\p{L})-(?=\p{L})/gu, '\u2011');
const serifWords = (s: string, fs: number): Node[] =>
  s.split(/\s+/).filter(Boolean).map((w) => h('div', { display: 'flex', marginRight: Math.round(fs * 0.25) }, w));

/** viewBox and path data of a design/logo SVG, so the card draws the same marks as the site. */
function svgPaths(file: string) {
  const src = readFileSync(file, 'utf8');
  const viewBox = src.match(/viewBox="([^"]+)"/)![1];
  const paths = [...src.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  return { viewBox, paths };
}

function card(c: OgCard, logo: { wordmark: ReturnType<typeof svgPaths>; asterisk: ReturnType<typeof svgPaths> }): Node {
  const label = (s: string | undefined) =>
    h('div', { display: 'flex', height: 22, marginBottom: 22, fontFamily: 'Plex Mono', fontWeight: 500, fontSize: 16, color: C.ink2, letterSpacing: 1.3 }, fitLabel((s ?? '').toUpperCase().replace(/\bV(?=\d)/g, 'v'), 16));
  const serif = (text: string, fit: { fs: number; whole: boolean }, style: Record<string, unknown>) =>
    h('div', { display: 'flex', flexWrap: 'wrap', fontFamily: 'Literata', fontSize: fit.fs, wordBreak: fit.whole ? 'normal' : 'break-all', ...style }, fit.whole ? serifWords(text, fit.fs) : text);
  const [wvx, wvy, wvw, wvh] = logo.wordmark.viewBox.split(/\s+/).map(Number);
  const wmH = 30;
  const wmW = Math.round((wvw / wvh) * wmH);

  let left: Node[];
  let right: Node[];
  let astTop: number | undefined;
  if (c.plain) {
    // Left: the section name as structure, set like the file bar. Right: "THIS SITE", the page name
    // (ours, a serif headline) and the description under it, sized to share the page.
    const name = trimWords(c.verso, 12);
    const desc = trimWords(c.recto, 28);
    const nameFit = fit(name, [54, 50, 46, 42, 39, 36, 33, 30], 0.54, 1.12, TEXT_H * 0.45);
    const descFit = fit(desc, [30, 28, 26, 24, 22, 20, 18], 0.5, 1.32, TEXT_H - nameFit.height - 18);
    left = [
      h('div', { display: 'flex', height: LABEL_H }),
      // Centred on the headline's first line, so the two pages start level.
      h('div', { display: 'flex', marginTop: Math.max(0, Math.round((nameFit.fs * 1.12 - 28 * 1.3) / 2)), fontFamily: 'Plex Mono', fontWeight: 600, fontSize: 28, lineHeight: 1.3, letterSpacing: 1.7, color: C.ink }, (c.versoLabel ?? c.verso).toUpperCase()),
    ];
    right = [
      label('This site'),
      serif(name, nameFit, { fontWeight: 600, lineHeight: 1.12, letterSpacing: -0.01 * nameFit.fs, color: C.ink }),
      serif(desc, descFit, { fontWeight: 400, lineHeight: 1.32, color: C.ink2, marginTop: 18 }),
    ];
  } else {
    const verso = trimWords(c.verso, 28);
    const recto = trimWords(c.recto, 28);
    // The source line under the quote: sentence case, at most two lines.
    const srcCpl = Math.floor(PAGE_W / (0.6 * 16));
    const source = c.source ? (c.source.length <= srcCpl * 2 ? c.source : `${c.source.slice(0, srcCpl * 2 - 1).trimEnd()}…`) : undefined;
    const srcH = source ? 20 + lineCount(source, srcCpl) * 22 : 0;
    const vFit = fit(verso, [40, 37, 34, 31, 28, 26, 24, 22, 20, 18], 0.6, 1.32, TEXT_H - srcH);
    const rFit = fit(recto, [54, 50, 46, 42, 39, 36, 33, 30, 28, 26, 24, 22], 0.54, 1.16);
    left = [
      label(c.versoLabel),
      h('div', { display: 'flex', fontFamily: 'Plex Mono', fontWeight: 400, fontSize: vFit.fs, lineHeight: 1.32, color: C.ink2, wordBreak: vFit.whole ? 'normal' : 'break-all' }, vFit.whole ? monoNoBreak(verso) : verso),
      ...(source ? [h('div', { display: 'flex', marginTop: 20, fontFamily: 'Plex Mono', fontWeight: 400, fontSize: 16, lineHeight: 1.375, color: C.ink2 }, source)] : []),
    ];
    right = [
      label(c.rectoLabel),
      serif(recto, rFit, { fontWeight: 600, lineHeight: 1.16, letterSpacing: -0.01 * rFit.fs, color: C.ink }),
    ];
    // The asterisk: level with the middle of the taller page, label to last line, inside the page area.
    const taller = LABEL_H + Math.max(vFit.height + srcH, rFit.height);
    astTop = Math.round(Math.min(Math.max(taller / 2 - AST_BOX / 2, 0), PAGE_H - AST_BOX));
  }

  return h('div', { width: W, height: H, display: 'flex', flexDirection: 'column', background: C.paper, padding: `48px ${PAD_X}px 34px` }, [
    // The two pages and the gutter.
    h('div', { display: 'flex', flexDirection: 'row', flexGrow: 1 }, [
      h('div', { display: 'flex', flexDirection: 'column', width: PAGE_W }, left),
      h('div', { display: 'flex', width: GUTTER, position: 'relative', justifyContent: 'center', alignItems: 'flex-start' }, [
        h('div', { position: 'absolute', left: GUTTER / 2, top: 0, bottom: 0, width: 1, background: C.rule }),
        ...(c.mark && !c.plain && astTop !== undefined
          ? [
              h('div', { display: 'flex', background: C.paper, padding: '12px 0', marginTop: astTop }, [
                h('svg', {}, logo.asterisk.paths.map((d) => h('path', {}, undefined, { d, fill: C.red })), { viewBox: logo.asterisk.viewBox, width: AST, height: AST }),
              ]),
            ]
          : []),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', width: PAGE_W }, right),
    ]),
    // The file bar: a double rule, the reference on the left, the wordmark on the right.
    h('div', { display: 'flex', flexDirection: 'column', marginTop: 24 }, [
      h('div', { display: 'flex', height: 1, background: C.ink }),
      h('div', { display: 'flex', height: 1, marginTop: 2, background: C.ink }),
      h('div', { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16 }, [
        h('div', { display: 'flex', fontFamily: 'Plex Mono', fontWeight: 600, fontSize: 20, letterSpacing: 1.2, color: C.ink, paddingBottom: 6 }, c.bar.length <= 60 ? c.bar : `${c.bar.slice(0, 59).trimEnd()}…`),
        h('svg', {}, logo.wordmark.paths.map((d, i) => h('path', {}, undefined, { d, fill: i === 0 ? C.ink : C.red })), {
          viewBox: `${wvx} ${wvy} ${wvw} ${wvh}`,
          width: wmW,
          height: wmH,
        }),
      ]),
    ]),
  ]);
}

/** Render every recorded card in `cardsDir` to `<outDir>/og/...png`. Returns the number written. */
async function renderCards(cardsDir: string, outDir: string, root: string) {
  const font = (f: string) => readFileSync(join(root, 'scripts/og-fonts', f));
  const fonts = [
    { name: 'Plex Mono', data: font('IBMPlexMono-Regular.woff'), weight: 400 as const, style: 'normal' as const },
    { name: 'Plex Mono', data: font('IBMPlexMono-Medium.woff'), weight: 500 as const, style: 'normal' as const },
    { name: 'Plex Mono', data: font('IBMPlexMono-SemiBold.woff'), weight: 600 as const, style: 'normal' as const },
    { name: 'Literata', data: font('literata-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    { name: 'Literata', data: font('literata-latin-600-normal.woff'), weight: 600 as const, style: 'normal' as const },
  ];
  const logo = {
    wordmark: svgPaths(join(root, 'design/logo/wordmark-inline.svg')),
    asterisk: svgPaths(join(root, 'design/logo/asterisk.svg')),
  };
  const files = readdirSync(cardsDir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(cardsDir, f), 'utf8')) as OgCard;
    // satori's element type is React's; our plain { type, props } objects are what it reads.
    const svg = await satori(card(c, logo) as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: false } }).render().asPng();
    const out = join(outDir, c.image.replace(/^\//, ''));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, png);
  }
  return files.length;
}

export default function og(): AstroIntegration {
  let cardsDir = '';
  let root = '';
  return {
    name: 'termsapply-og',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        if (command !== 'build') return;
        root = fileURLToPath(config.root);
        cardsDir = fileURLToPath(new URL('og-cards/', config.cacheDir));
        rmSync(cardsDir, { recursive: true, force: true });
        process.env.TERMSAPPLY_OG_CARDS = cardsDir;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!cardsDir) return;
        const exists = (() => { try { return statSync(cardsDir).isDirectory(); } catch { return false; } })();
        if (!exists) throw new Error('termsapply-og: no cards were recorded (does every page use Base.astro?)');
        const t = Date.now();
        const n = await renderCards(cardsDir, fileURLToPath(dir), root);
        logger.info(`${n} Open Graph images written to og/ in ${Date.now() - t}ms`);
        delete process.env.TERMSAPPLY_OG_CARDS;
      },
    },
  };
}
