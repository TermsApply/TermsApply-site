/**
 * textdiff: a word-level comparison of two versions of one document, computed at build time, so the
 * marks on the "Document changes" page are mechanical and never chosen by hand.
 *
 * Method (also stated on the page):
 *   1. Each text is split into blocks, one per non-empty line of the .txt file as served. A block
 *      that starts with a list marker ("1. ", "- ", indented three spaces per level) is a list item;
 *      a block listed in `headings` is a heading of the document.
 *   2. Each block is split into words (runs of non-space characters). The marker of a list item is
 *      not a word: it is formatting added when the text was taken from the page.
 *   3. Words are compared after folding typographic quote marks (’ ‘ → ', “ ” → "); spacing, line
 *      breaks and list markers therefore never count as a difference.
 *   4. The longest common subsequence of the two word sequences, over the whole document, gives the
 *      words both versions share, in order. Then every shared run shorter than MIN_RUN words that
 *      stands between two changes is counted as changed too, so a rewritten passage is not marked as
 *      a scatter of single shared words ("the", "and").
 *   5. In the later version, words not shared are marked as added. The earlier version is printed
 *      without marks (its words not shared are counted, not marked).
 *
 * Nothing here interprets the text: no word is weighted, nothing is skipped.
 */

export const MIN_RUN = 3;

export type Seg = { text: string; changed: boolean };
export type Block = { kind: 'heading' | 'para' | 'item'; level: number; marker?: string; segs: Seg[] };
export type Side = { blocks: Block[]; words: number; shared: number };
export type DocDiff = { before: Side; after: Side; lcsShared: [number, number] };

const MARKER = /^((?: {3})*)(\d+\.|-) (.*)$/;
const fold = (w: string) => w.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

type Tok = { word: string; key: string; block: number };
type Parsed = { blocks: { kind: Block['kind']; level: number; marker?: string }[]; toks: Tok[] };

function parse(text: string, headings: string[]): Parsed {
  const heads = new Set(headings.map((h) => h.trim()));
  const blocks: Parsed['blocks'] = [];
  const toks: Tok[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim()) continue;
    const m = raw.match(MARKER);
    const body = m ? m[3] : raw.trim();
    const kind: Block['kind'] = m ? 'item' : heads.has(raw.trim()) ? 'heading' : 'para';
    const n = blocks.push({ kind, level: m ? m[1].length / 3 : 0, marker: m ? m[2] : undefined }) - 1;
    for (const word of body.split(/\s+/).filter(Boolean)) toks.push({ word, key: fold(word), block: n });
  }
  // A heading named in `headings` that the text does not contain is an error in the data.
  for (const h of heads) if (!text.split('\n').some((l) => l.trim() === h)) throw new Error(`textdiff: heading not in text: "${h}"`);
  return { blocks, toks };
}

/** Longest common subsequence of two key sequences: for each side, which positions are shared. */
function lcs(a: string[], b: string[]): [boolean[], boolean[]] {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      t[i * w + j] = a[i] === b[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
  const sa = new Array<boolean>(n).fill(false);
  const sb = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { sa[i] = sb[j] = true; i++; j++; }
    else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) i++;
    else j++;
  }
  return [sa, sb];
}

/**
 * Shared runs as pairs of ranges. LCS matches come in order on both sides, so walking both flags
 * together yields aligned runs; a run is broken wherever either side has an unshared word.
 */
function runs(sa: boolean[], sb: boolean[]) {
  const out: { a: number; b: number; len: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < sa.length && j < sb.length) {
    if (!sa[i]) { i++; continue; }
    if (!sb[j]) { j++; continue; }
    const last = out.at(-1);
    if (last && last.a + last.len === i && last.b + last.len === j) last.len++;
    else out.push({ a: i, b: j, len: 1 });
    i++;
    j++;
  }
  return out;
}

function side(p: Parsed, shared: boolean[]): Side {
  const blocks: Block[] = p.blocks.map((b) => ({ ...b, segs: [] }));
  p.toks.forEach((t, k) => {
    const segs = blocks[t.block].segs;
    const changed = !shared[k];
    const last = segs.at(-1);
    if (last && last.changed === changed) last.text += ` ${t.word}`;
    else segs.push({ text: last ? ` ${t.word}` : t.word, changed });
  });
  // The space between two segments belongs to the unchanged one, so a mark starts and ends on a word.
  for (const b of blocks)
    for (let k = 1; k < b.segs.length; k++)
      if (b.segs[k].changed && b.segs[k].text.startsWith(' ')) { b.segs[k].text = b.segs[k].text.slice(1); b.segs[k - 1].text += ' '; }
  return { blocks, words: p.toks.length, shared: shared.filter(Boolean).length };
}

export function diffDocuments(
  before: { text: string; headings?: string[] },
  after: { text: string; headings?: string[] },
): DocDiff {
  const pa = parse(before.text, before.headings ?? []);
  const pb = parse(after.text, after.headings ?? []);
  const [sa, sb] = lcs(pa.toks.map((t) => t.key), pb.toks.map((t) => t.key));
  const lcsShared: [number, number] = [sa.filter(Boolean).length, sb.filter(Boolean).length];
  // Step 4: a short shared run between two changes counts as changed. Runs at the very start or end
  // of the text, or touching no change on one side, are kept.
  const rs = runs(sa, sb);
  rs.forEach((r, k) => {
    if (r.len >= MIN_RUN) return;
    const changeBefore = k === 0 ? r.a > 0 || r.b > 0 : rs[k - 1].a + rs[k - 1].len < r.a || rs[k - 1].b + rs[k - 1].len < r.b;
    const next = rs[k + 1];
    const endA = r.a + r.len;
    const endB = r.b + r.len;
    const changeAfter = next ? next.a > endA || next.b > endB : endA < sa.length || endB < sb.length;
    if (changeBefore && changeAfter) for (let x = 0; x < r.len; x++) { sa[r.a + x] = false; sb[r.b + x] = false; }
  });
  return { before: side(pa, sa), after: side(pb, sb), lcsShared };
}
