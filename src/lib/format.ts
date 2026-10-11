/** Dates are stored as UTC midnights; always format in UTC so nothing shifts a day. */
type DateLike = Date | string;

const toDate = (d: DateLike) => (d instanceof Date ? d : new Date(d));

/** A field written with `backticked` names, as plain text: the backticks dropped (see Inline.astro). */
export const plain = (t: string) => t.replace(/`([^`\n]+)`/g, '$1');

/** 2026-09-14 */
export const iso = (d: DateLike) => toDate(d).toISOString().slice(0, 10);

/** 14 Sep 2026 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
/** Fixed three-letter months: Node's en-GB ICU data writes "Sept", the house style is "Sep". */
export const long = (d: DateLike) => {
  const x = toDate(d);
  return `${dayMonth(x)} ${x.getUTCFullYear()}`;
};

/** 2 */
const day = (d: DateLike) => String(toDate(d).getUTCDate());

export const categoryLabel = (c: 'surveillance' | 'soma') => (c === 'surveillance' ? 'Surveillance' : 'Soma');

/** Minutes to read a body, at 220 words a minute. */
export function readingTime(body = '') {
  const text = body
    .replace(/^(import|export) .*$/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** "2–11 Sep 2026" within one month, "28 Aug – 3 Sep 2026" within a year, else two long dates. */
export function range(from: DateLike, to: DateLike) {
  const a = toDate(from), b = toDate(to);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  if (sameYear && a.getUTCMonth() === b.getUTCMonth()) return `${day(a)}–${long(b)}`;
  if (sameYear) {
    return `${dayMonth(a)} – ${long(b)}`;
  }
  return `${long(a)} – ${long(b)}`;
}

/** Whole days from one UTC date to another (negative when `to` is earlier). */
const daysBetween = (from: DateLike, to: DateLike) =>
  Math.round((toDate(to).valueOf() - toDate(from).valueOf()) / 86_400_000);

/** The interval row: "+ 33 days", "+ 1 day". Days only, by design. */
export const interval = (from: DateLike, to: DateLike) => {
  const n = daysBetween(from, to);
  return `+ ${n.toLocaleString('en-GB')} ${n === 1 ? 'day' : 'days'}`;
};

/**
 * Trim a verbatim quote to about `max` words for a list row. The cut never lands inside a word and
 * drops trailing punctuation before the ellipsis, so the quoted words stay exactly as published.
 */
export function trimWords(text: string, max = 20): { text: string; trimmed: boolean } {
  const words = text.trim().split(/\s+/);
  if (words.length <= max + 2) return { text: text.trim(), trimmed: false };
  return { text: `${words.slice(0, max).join(' ').replace(/[,;:.]+$/, '')}…`, trimmed: true };
}

/**
 * Word-level difference between two sentences, for the corrections register: each side as runs of
 * text, `changed` where the words are not shared (longest common subsequence of words; trailing
 * punctuation is its own token, so "4.2.8." against "4.8.2." marks the number and not the full stop;
 * spaces stay with the token before them, so joining the runs gives the sentence back exactly).
 */
export function wordDiff(a: string, b: string): { was: { text: string; changed: boolean }[]; now: { text: string; changed: boolean }[] } {
  const tokens = (t: string) =>
    [...t.matchAll(/(\S+)(\s*)/g)].flatMap(([, w, sp]) => {
      const [, core, punct] = w.match(/^(.*?)([.,;:!?)\]"”’]*)$/)!;
      return core && punct ? [core, punct + sp] : [w + sp];
    });
  const ta = tokens(a);
  const tb = tokens(b);
  const key = (t: string) => t.trim();
  const n = ta.length, m = tb.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = key(ta[i]) === key(tb[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keepA = new Array<boolean>(n).fill(false), keepB = new Array<boolean>(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (key(ta[i]) === key(tb[j])) { keepA[i++] = true; keepB[j++] = true; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const runs = (toks: string[], keep: boolean[]) => {
    const out: { text: string; changed: boolean }[] = [];
    toks.forEach((t, i) => {
      const changed = !keep[i];
      const last = out.at(-1);
      if (last && last.changed === changed) last.text += t;
      else out.push({ text: t, changed });
    });
    return out;
  };
  return { was: runs(ta, keepA), now: runs(tb, keepB) };
}
