import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { iso, trimWords } from './format';
import type { OgInput } from './og';
import { PAGE_SIZE, SHOW_INTERVAL, SITE } from './site';
import type { Topic } from './topics';

export type Category = 'surveillance' | 'soma';

/**
 * The left page of an index row: their sentence (`voice: 'theirs'`, set in mono, with its clause) or,
 * for a piece with no quotable sentence on file, our dek (`voice: 'ours'`, set in serif, no asterisk).
 */
interface Said {
  text: string;
  clause?: string;
  trimmed?: boolean;
  voice: 'theirs' | 'ours';
}

/** A row in a case index: investigations normalise to this. */
export interface CaseItem {
  ref: string; // "0042"
  kind: 'INV';
  href: string;
  title: string;
  service?: string;
  summary?: string;
  category?: Category;
  date?: Date;
  said?: Said; // left page of the pair (see saidOf)
  seen?: string; // the first finding's observed sentence, when there is one
  topics?: Topic[];
}

type Quotable = {
  pull?: string;
  pullClause?: string;
  dek: string;
  findings: { quote: string; clause: string; observed: string }[];
};

/**
 * The quotable sentence for a piece: `pull` (with the clause of the finding it comes from, or
 * `pullClause`), else findings[0].quote trimmed to about 20 words, else the dek in our own voice.
 */
export function saidOf(d: Quotable): Said {
  if (d.pull) {
    const from = d.findings.find((f) => f.quote.includes(d.pull!));
    return { text: d.pull, clause: d.pullClause ?? from?.clause, voice: 'theirs' };
  }
  const f = d.findings[0];
  if (f) {
    const t = trimWords(f.quote, 20);
    return { text: t.text, trimmed: t.trimmed, clause: f.clause, voice: 'theirs' };
  }
  return { text: d.dek, voice: 'ours' };
}

const byDateDesc = (a: { date?: Date }, b: { date?: Date }) =>
  (b.date?.valueOf() ?? 0) - (a.date?.valueOf() ?? 0);

async function serviceName(id: string) {
  const s = await getEntry('services', id);
  if (!s) throw new Error(`Unknown service "${id}"`);
  return s.data.name;
}

export async function investigationItem(e: CollectionEntry<'investigations'>): Promise<CaseItem> {
  return {
    ref: e.data.draft ? `${e.data.fileNo} / DRAFT` : e.data.fileNo,
    kind: 'INV',
    href: `/publications/${e.id}/`,
    title: e.data.title,
    service: await serviceName(e.data.service.id),
    summary: e.data.summary ?? e.data.dek,
    category: e.data.category,
    date: e.data.date,
    said: saidOf(e.data),
    seen: e.data.findings[0]?.observed,
    topics: e.data.topics,
  };
}

export async function getInvestigations() {
  return (await getCollection('investigations')).sort((a, b) => byDateDesc(a.data, b.data));
}

/* ---------- Pagination ---------- */

/** One page of an index, as getStaticPaths props (see `paginatePaths`). */
export interface IndexPage<T> {
  data: T[];
  current: number; // 1-based
  last: number;
  total: number; // items across all pages
  start: number; // 0-based index of the first item on this page
  url: string;
  prevUrl?: string;
  nextUrl?: string;
}

/** /publications/ for page 1, /publications/page/2/ after it. Page 1 never has a /page/1/ address. */
const pageUrl = (base: string, n: number) => (n <= 1 ? base : `${base}page/${n}/`);

/**
 * getStaticPaths entries for an index in a `[...page].astro` route: `params.page` is undefined for
 * page 1 (the section's own address) and "page/N" after it. Astro's own paginate() would give
 * /publications/2/; the addresses here keep the word "page" in them. At least one page is built,
 * even for an empty list. `base` ends in a slash: "/publications/".
 */
export function paginatePaths<T>(items: T[], base: string, size = PAGE_SIZE) {
  const last = Math.max(1, Math.ceil(items.length / size));
  return Array.from({ length: last }, (_, i) => {
    const current = i + 1;
    const page: IndexPage<T> = {
      data: items.slice(i * size, current * size),
      current,
      last,
      total: items.length,
      start: i * size,
      url: pageUrl(base, current),
      prevUrl: current > 1 ? pageUrl(base, current - 1) : undefined,
      nextUrl: current < last ? pageUrl(base, current + 1) : undefined,
    };
    return { params: { page: current === 1 ? undefined : `page/${current}` }, props: { page } };
  });
}

/** "PAGE 2 OF 3", for a file bar's side note; empty on a one-page index. */
const pageNote = (p: { current: number; last: number }) => (p.last > 1 ? `PAGE ${p.current} OF ${p.last}` : '');

/** Append the page note to an index's side note, when there is more than one page. */
export function withPageNote(side: Part, p: { current: number; last: number }): Part {
  const note = pageNote(p);
  if (!note) return side;
  const parts = ([] as (string | Date)[]).concat(side);
  return parts.length ? [...parts, ` / ${note}`] : note;
}

/** Resolve a `related` list from frontmatter. Fails the build on a dangling pointer. */
export async function resolveRelated(
  list: { collection: 'investigations'; id: string }[],
): Promise<CaseItem[]> {
  return Promise.all(
    list.map(async ({ collection, id }) => {
      const e = await getEntry(collection, id);
      if (!e) throw new Error(`Related item not found: ${collection}/${id}`);
      return investigationItem(e);
    }),
  );
}

/* ---------- File header fields ---------- */

/** Split ISO dates out of a free-text value so they render as <time> (and never break mid-date). */
const withDates = (text: string): (string | Date)[] =>
  text.split(/(\d{4}-\d{2}-\d{2})/).filter(Boolean).map((t) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00Z`) : t));

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Right-hand side of a section index's FileHeader bar: "NEWEST 2026-09-14 / 2 SURVEILLANCE / 2 SOMA".
 * Categories with no items are left out.
 */
export function indexSide(items: { date?: Date; category?: Category }[]): Part {
  const newest = items.map((i) => i.date).filter((d): d is Date => Boolean(d)).sort((a, b) => b.valueOf() - a.valueOf())[0];
  const surv = items.filter((i) => i.category === 'surveillance').length;
  const soma = items.filter((i) => i.category === 'soma').length;
  const tail = [surv ? `${surv}\u00a0SURVEILLANCE` : '', soma ? `${soma}\u00a0SOMA` : ''].filter(Boolean).join(' / ');
  if (!newest) return tail;
  return tail ? ['NEWEST ', newest, ` / ${tail}`] : ['NEWEST ', newest];
}

/** Left-hand side of a section index's FileHeader bar: "PUBLICATIONS / 4 FILES". */
export const indexRef = (section: string, n: number, one: string, many: string) =>
  `${section} / ${count(n, one, many)}`.toUpperCase();

/** A run of text in a file-header cell. Dates render as <time datetime="…">YYYY-MM-DD</time>. */
export type Part = string | Date | (string | Date)[];

/**
 * One cell of the FileHeader grid (a file without a `category` has no Category cell). Give `category` instead of `value` to render a CategoryTag.
 * `href` (optional) links the value, e.g. a service name to its /services/<slug>/ profile.
 */
export interface FileField {
  label: string;
  value?: Part;
  sub?: Part;
  category?: Category;
  href?: string;
}

/**
 * Standard FileHeader cells for an investigation.
 * `lead`: the compact six-cell grid on the home page (service / platforms / policy / tested / category / reply).
 * `article`: the grid at the top of the file itself (tested platforms, app versions, previous policy, status).
 * `opts.linkService`: link the service name to its profile, /services/<slug>/ (default false).
 */
export function investigationFields(
  e: CollectionEntry<'investigations'>,
  service: CollectionEntry<'services'>,
  mode: 'lead' | 'article' = 'article',
  opts: { linkService?: boolean } = {},
): FileField[] {
  const d = e.data;
  const serviceHref = opts.linkService ? `/services/${service.id}/` : undefined;
  const versions = (d.appVersions ?? '').split(';').map((s) => s.trim()).filter(Boolean);
  const status = replyStatus(d, `investigations/${e.id}`);

  if (mode === 'lead') {
    return [
      { label: 'Service', value: service.data.name, sub: service.data.kind, href: serviceHref },
      {
        label: 'Platforms',
        value: service.data.platforms.join(', '),
        sub: versions[0] ? `app ${versions[0].replace(/\s*\(.*\)$/, '')}` : undefined,
      },
      { label: 'Policy', value: d.policyVersion, sub: d.policyVersion === iso(d.policyDate) ? undefined : ['eff. ', d.policyDate] },
      { label: 'Tested', value: d.testedFrom, sub: ['to ', d.testedTo] },
      ...(d.category ? [{ label: 'Category', category: d.category }] : []),
      { label: 'Company reply', value: status.short, sub: d.companyAsked ? ['asked ', d.companyAsked] : undefined },
    ];
  }

  const [p1, p2, ...rest] = d.platforms;
  return [
    {
      label: 'Service',
      value: service.data.name,
      sub: service.data.kind,
      href: serviceHref,
    },
    {
      label: 'Platforms tested',
      // The list runs on into the sub line, so the value ends on a comma when there is more.
      value: [p1, p2].filter(Boolean).join(', ') + (rest.length ? ',' : ''),
      sub: rest.length ? rest.join(', ') : undefined,
    },
    ...(versions.length
      ? [{ label: 'App versions', value: versions[0], sub: versions.slice(1).join('; ') || undefined }]
      : [{ label: 'Tested', value: d.testedFrom, sub: ['to ', d.testedTo] } as FileField]),
    {
      label: 'Policy',
      value: d.policyVersion === iso(d.policyDate) ? d.policyVersion : [`${d.policyVersion}, eff. `, d.policyDate],
      sub: d.policyPrev ? ['prev. ', ...withDates(d.policyPrev)] : undefined,
    },
    ...(d.category ? [{ label: 'Category', category: d.category } as FileField] : []),
    d.companyAsked
      ? { label: 'Status', value: ['Company asked ', d.companyAsked], sub: status.long }
      : { label: 'Status', value: status.long },
  ];
}

/* ---------- Company reply ---------- */

/** Weekdays after `from`, up to and not including `to` (public holidays are not counted out). */
export function workingDaysBetween(from: Date, to: Date) {
  let n = 0;
  for (let t = from.valueOf() + 86_400_000; t < to.valueOf(); t += 86_400_000) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

type Replying = {
  companyReply?: string;
  companyAsked?: Date;
  date: Date;
  replyDue?: { date: Date; time?: string };
  reply?: { date: Date; channel: string; from: string; followUps?: { date: Date; channel?: string; from?: string }[] };
};

/**
 * The company-reply status of a file, from `companyReply` ("None", "Awaiting", "Declined",
 * "Replied YYYY-MM-DD") and the full `reply`, when there is one. `short` is the one-word cell ("No
 * reply", "Awaiting reply", "Declined", "Replied 2026-06-29"), `long` the Status line ("No reply
 * within five working days", "Reply due 2026-10-15, 23:59 CEST", "Declined 2026-08-24", "Replied
 * 2026-06-29"). Fails the build when the fields contradict each other: a reply on file with
 * companyReply None or Awaiting, "Replied" with a date other than the reply's, "Awaiting" without
 * `replyDue`, or, once the site is launched, "Awaiting" a reply due before the publication date.
 * Messages that only acknowledge the questions (`acknowledgements`) never change the status.
 */
export function replyStatus(d: Replying, where = 'file'): { kind: 'none' | 'awaiting' | 'declined' | 'replied'; short: Part; long: Part } {
  const raw = (d.companyReply ?? (d.reply ? `Replied ${d.reply.date.toISOString().slice(0, 10)}` : 'None')).trim();
  if (raw === 'Awaiting') {
    if (d.reply) throw new Error(`${where}: companyReply is "Awaiting" but the file has a reply on file; use Replied YYYY-MM-DD`);
    const due = d.replyDue;
    if (!due) throw new Error(`${where}: companyReply "Awaiting" needs replyDue (the deadline given to the company)`);
    if (SITE.launched && due.date < d.date)
      throw new Error(`${where}: still "Awaiting" a reply that was due ${iso(due.date)}, before publication on ${iso(d.date)}; set companyReply to "None" or "Replied YYYY-MM-DD"`);
    const long: Part = due.time ? ['Reply due ', due.date, `, ${due.time}`] : ['Reply due ', due.date];
    return { kind: 'awaiting', short: 'Awaiting reply', long };
  }
  const replied = raw.match(/^Replied (\d{4}-\d{2}-\d{2})$/);
  if (replied) {
    const date = new Date(`${replied[1]}T00:00:00Z`);
    if (d.reply && d.reply.date.valueOf() !== date.valueOf())
      throw new Error(`${where}: companyReply says ${raw} but reply.date is ${d.reply.date.toISOString().slice(0, 10)}`);
    // Further messages are named on the Status line too, each with its date.
    const further: Part = (d.reply?.followUps ?? []).flatMap((m) => ['; further message ', m.date] as (string | Date)[]);
    return { kind: 'replied', short: ['Replied ', date], long: ['Replied ', date, ...further] };
  }
  if (raw === 'Declined') {
    return { kind: 'declined', short: 'Declined', long: d.reply ? ['Declined ', d.reply.date] : 'Declined to comment' };
  }
  if (d.reply) throw new Error(`${where}: companyReply is "${raw}" but the file has a reply on file; use Declined or Replied YYYY-MM-DD`);
  const days = d.companyAsked ? workingDaysBetween(d.companyAsked, d.date) : 0;
  const long = !d.companyAsked
    ? 'No reply'
    : days >= 5
      ? 'No reply within five working days'
      : `No reply at publication, ${days} working ${days === 1 ? 'day' : 'days'} after asking`;
  return { kind: 'none', short: 'No reply', long };
}

/** The first `max` words of a reply, for the teaser on the story page. */
export const replyExcerpt = (text: string, max = 40) => trimWords(text.replace(/\s+/g, ' '), max);

/** A reply's text as paragraphs of lines: blank lines part paragraphs, single line breaks are kept. */
export const replyParagraphs = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((p) => p.length > 0);

/* ---------- Corrections ---------- */

type CorrectionCollection = 'investigations';

/** Anchor of a correction on /corrections/: #cr-0001. */
export const correctionId = (id: string) => id.toLowerCase();
/** A correction's address on the register's page `page` (1 is /corrections/). getCorrections() sets
    each entry's `href` with the right page; use that where you have the entry. */
const correctionHref = (id: string, page = 1) => `${pageUrl('/corrections/', page)}#${correctionId(id)}`;

const squash = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');

/**
 * Every correction, newest first, each with the file it corrects resolved to a title and an address.
 * Fails the build when the file does not exist, or when the corrected sentence (`now`) cannot be
 * found word for word in that file's frontmatter or body, so the register never claims a wording
 * the file does not carry.
 */
let correctionsCache: ReturnType<typeof loadCorrections> | undefined;
export function getCorrections() {
  // Loaded once per build: every story, history and reply page asks for the register.
  return (correctionsCache ??= loadCorrections());
}
async function loadCorrections() {
  const all = await getCollection('corrections');
  const out = await Promise.all(
    all.map(async (c) => {
      const { collection, id } = c.data.file;
      const e = await getEntry(collection, id);
      if (!e) throw new Error(`Correction ${c.data.id}: no ${collection} entry "${id}" (src/content/corrections/${c.id}.md)`);
      const haystack = squash(`${JSON.stringify(e.data)} ${e.body ?? ''}`.replace(/\\"/g, '"'));
      if (!haystack.includes(squash(c.data.now)))
        throw new Error(`Correction ${c.data.id}: the corrected sentence ("now") is not in ${collection}/${id}. Correct the file first, then quote it exactly.`);
      const d = e.data;
      const target = { title: d.title, href: fileHref('investigations', id), label: `File ${d.fileNo}` };
      return { ...c.data, entryId: c.id, target };
    }),
  );
  out.sort((a, b) => b.date.valueOf() - a.date.valueOf() || b.id.localeCompare(a.id));
  // The register is paginated newest first; each entry links to the page it is printed on.
  return out.map((c, i) => ({ ...c, href: correctionHref(c.id, Math.floor(i / PAGE_SIZE) + 1) }));
}

/** Corrections for one file, oldest first (for its revision log). */
export async function correctionsFor(collection: CorrectionCollection, id: string) {
  return (await getCorrections()).filter((c) => c.file.collection === collection && c.file.id === id).reverse();
}

type CorrectionLine = { id: string; date: Date; why: string; href?: string };
const correctionLines = (list: CorrectionLine[]): LogLine[] =>
  list.map((c) => ({ date: c.date, ref: { label: `Correction ${c.id}`, href: c.href ?? correctionHref(c.id) }, what: c.why }));

/* ---------- One file, four addresses ---------- */

/**
 * The parts of a file (round 4): the story (tab "Report") at /publications/<slug>/, the changed
 * company documents at …/documents/ (files with `documents` only), the correspondence at
 * …/correspondence/ (files with `correspondence` only), the evidence at …/evidence/ (files with an
 * evidence file only), the company's reply at …/reply/ (files with a `reply` and no
 * `correspondence`: the correspondence prints the reply) and the history at …/history/.
 */
export type FilePart = 'story' | 'documents' | 'correspondence' | 'evidence' | 'reply' | 'history';

/** Which parts a file has, for the tab row (FileTabs) and the pages that build them. */
export const filePartsOf = (
  d: { reply?: unknown; correspondence?: unknown[]; documents?: unknown[] },
  hasEvidence: boolean,
) => ({
  documents: (d.documents?.length ?? 0) > 0,
  correspondence: (d.correspondence?.length ?? 0) > 0,
  evidence: hasEvidence,
  reply: Boolean(d.reply) && !(d.correspondence?.length ?? 0),
});
export type FileCollection = 'investigations';

/** The URL section of each file collection: the `investigations` collection is published under /publications/. */
const FILE_SECTION: Record<FileCollection, string> = { investigations: 'publications' };

export const fileHref = (collection: FileCollection, slug: string, part: FilePart = 'story') =>
  `/${FILE_SECTION[collection]}/${slug}/${part === 'story' ? '' : `${part}/`}`;

/** Anchor of an exhibit on the evidence page: #exh-1. Exhibit.astro uses the same id. */
export const exhibitId = (n: number | string) => `exh-${n}`;

/** The evidence file for an investigation, if it has one. Fails the build on two files for one slug. */
export async function getEvidence(slug: string) {
  const found = await getCollection('evidence', (e) => e.data.file.id === slug);
  if (found.length > 1) throw new Error(`Two evidence files for investigation "${slug}": ${found.map((e) => e.id).join(', ')}`);
  return found[0];
}

/** Exhibits in an evidence body, in order, from its <Exhibit n={…} caption="…"> tags. */
export function exhibitsIn(body = ''): { n: number; caption: string }[] {
  return body
    .split(/<Exhibit\b/)
    .slice(1)
    .map((chunk) => {
      // Attributes come before any children, so the first n and caption in the chunk are the tag's own.
      const n = chunk.match(/\bn=\{\s*(\d+)\s*\}/)?.[1] ?? chunk.match(/\bn="(\d+)"/)?.[1];
      const caption = chunk.match(/\bcaption="([^"]*)"/)?.[1] ?? '';
      return n ? { n: Number(n), caption } : undefined;
    })
    .filter((x): x is { n: number; caption: string } => Boolean(x));
}

/** Exhibit numbers a story body points at with <ExhibitRef n={…} />. */
export const exhibitRefsIn = (body = '') =>
  [...body.matchAll(/<ExhibitRef\b[^>]*?\bn=\{\s*(\d+)\s*\}/g)].map((m) => Number(m[1]));

/** First exhibit number in an evidenceRef such as "Exh. 1, 3". */
export const firstExhibit = (ref?: string) => {
  const m = ref?.match(/\d+/);
  return m ? Number(m[0]) : undefined;
};

/**
 * One line of a file's own revision log (the History page): a date, what happened, and, where the
 * gap between a policy taking effect and our observation is known, the interval ("+ 33 days").
 */
export interface LogLine {
  date: Date;
  what: string;
  /** A linked lead-in before `what`, e.g. "Correction CR-0002" to /corrections/#cr-0002. */
  ref?: { label: string; href: string };
  interval?: { from: Date; to: Date; label: string };
}

const parseDated = (text?: string) => {
  const m = text?.match(/^(\S+?),?\s+(\d{4}-\d{2}-\d{2})/);
  return m ? { version: m[1], date: new Date(`${m[2]}T00:00:00Z`) } : undefined;
};

/**
 * The revision log of an investigation, oldest first. `corrections` (from correctionsFor) are merged
 * in as "Correction CR-0002: <why>" lines linking to the register.
 */
export function investigationLog(
  e: CollectionEntry<'investigations'>,
  serviceName: string,
  corrections: CorrectionLine[] = [],
): LogLine[] {
  const d = e.data;
  const status = replyStatus(d, `investigations/${e.id}`);
  const atPublication =
    status.kind === 'none'
      ? `with no reply from ${serviceName}${d.companyAsked && workingDaysBetween(d.companyAsked, d.date) >= 5 ? ' within five working days' : ''}`
      : status.kind === 'awaiting'
        ? `awaiting ${serviceName}’s reply, due ${iso(d.replyDue!.date)}${d.replyDue!.time ? `, ${d.replyDue!.time}` : ''}`
        : status.kind === 'declined'
        ? `after ${serviceName} declined to comment`
        : `with ${serviceName}’s reply printed in full`;
  // The first reply and every further message, each dated; those after publication say so.
  const replies: LogLine[] = d.reply
    ? [
        replyLine(d.reply, d.reply.date > d.date),
        ...(d.reply.followUps ?? []).map((m) =>
          replyLine({ date: m.date, from: m.from ?? d.reply!.from, channel: m.channel ?? d.reply!.channel }, m.date > d.date, true),
        ),
      ]
    : [];
  // Acknowledgements are dated messages too, but never a reply.
  const acks: LogLine[] = d.acknowledgements.map((a) => ({
    date: a.date,
    what: `Acknowledgement received from ${a.from} by ${a.channel}${a.time ? `, ${a.time}` : ''}${a.date > d.date ? ', after publication' : ''}.`,
  }));
  const prev = parseDated(d.policyPrev);
  const later = parseDated(d.policyLater);
  // Our own messages after the first, from the correspondence, each dated.
  const ours: LogLine[] = d.correspondence
    .filter((m) => m.side === 'ours')
    .slice(1)
    .map((m) => ({ date: new Date(m.sent.length === 10 ? `${m.sent}T00:00:00Z` : m.sent.replace(/Z$/, ':00Z')), what: m.gist ? `Further message sent to ${serviceName} in writing: ${m.gist}` : `Further message sent to ${serviceName} in writing.` }));
  const first = d.findings[0];
  const seen = first?.observedAt;
  const from = first?.effective ?? d.policyDate;
  const lines: LogLine[] = [
    ...(prev ? [{ date: prev.date, what: `Policy ${prev.version} takes effect: the version before the one examined.` }] : []),
    { date: d.policyDate, what: later ? `Policy ${d.policyVersion} takes effect: the version in force during testing, examined in this file.` : `Policy ${d.policyVersion} takes effect: the version this file examines.` },
    ...(later ? [{ date: later.date, what: `Policy ${later.version} takes effect: a later version, also examined in this file.` }] : []),
    {
      date: d.testedFrom,
      what: `Testing begins on ${d.platforms.join(', ')}.`,
      // Without a dated first observation, the interval runs to the first day of testing, as in the head pair.
      interval: seen ? undefined : { from, to: d.testedFrom, label: `after ${d.policyVersion} took effect` },
    },
    ...(seen
      ? [{ date: seen, what: `First observation: ${lowerFirst(firstSentence(first.observed))}`, interval: { from, to: seen, label: `after ${d.policyVersion} took effect` } }]
      : []),
    ...(d.companyAsked ? [{ date: d.companyAsked, what: `Questions sent to ${serviceName} in writing.` }] : []),
    ...ours,
    { date: d.testedTo, what: 'Testing ends.' },
    ...acks.filter((l) => l.date <= d.date),
    ...replies.filter((l) => l.date <= d.date),
    d.draft
      ? { date: d.date, what: `Draft ${d.draft} of file ${d.fileNo}; the file is not yet published.` }
      : d.publicFrom
        ? { date: d.date, what: `File ${d.fileNo} published, ${atPublication}; online for the vendor only until ${iso(d.publicFrom.date)}.` }
        : { date: d.date, what: `File ${d.fileNo} published, ${atPublication}.` },
    // Access restricted at publication, opened to everyone later.
    ...(d.publicFrom && !d.draft ? [{ date: d.publicFrom.date, what: d.publicFrom.time ? `Public access from ${d.publicFrom.time}.` : 'Public access.' }] : []),
    ...acks.filter((l) => l.date > d.date),
    ...replies.filter((l) => l.date > d.date),
    ...(d.revised ? [{ date: d.revised, what: `File ${d.fileNo} revised.` }] : []),
    ...correctionLines(corrections),
  ];
  // Stable sort keeps same-day lines in the order written above.
  // An observation before the policy took effect is not a gap: the line stays, the interval goes.
  // SHOW_INTERVAL off (src/lib/site.ts): no line carries the "+ n days" count.
  return lines
    .map((l) => (l.interval && (!SHOW_INTERVAL || l.interval.to < l.interval.from) ? { ...l, interval: undefined } : l))
    .sort((a, b) => a.date.valueOf() - b.date.valueOf());
}

const replyLine = (r: { date: Date; from: string; channel: string }, late = false, further = false): LogLine => ({
  date: r.date,
  what: `${further ? 'Further message' : 'Reply'} received from ${r.from} by ${r.channel}${late ? ', after publication' : ''}.`,
});

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
// The first sentence only: the log line should not run ahead of its date.
const firstSentence = (s: string) => { const m = s.match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : s; };

/* ---------- Open Graph cards (block C, src/lib/og.ts) ---------- */

type Carded = Omit<Quotable, 'findings'> & {
  findings: { quote: string; clause: string; observed: string; source: string }[];
  fileNo?: string;
  policyVersion: string;
  date: Date;
  revised?: Date;
};

/**
 * The left page of a file's card: their words only, in mono, under the page's own left label
 * ("Declared"), with the source line under the quote (round 5).
 *   - The file's quotable sentence (saidOf: `pull`, else the first finding's quote trimmed to about
 *     20 words), in quotes; its source line is the finding's own `source` and clause when the
 *     sentence comes from a finding, else "<Service> Privacy Policy <version>, §5" (a `pull` with
 *     `pullClause` and no finding that contains it).
 *   - Else nothing of theirs is on file. saidOf then falls back to our dek, which must never be set
 *     in mono, so the card is a plain one: the section as structure on the left, "No quotable
 *     sentence on file" and the page's own words (the page's `recto`) on the right, in serif, and
 *     no asterisk.
 */
export function fileOgVerso(
  d: Carded,
  ctx: { service: string; section: 'Publications' },
): Pick<OgInput, 'verso' | 'versoLabel' | 'source' | 'mark' | 'plain'> {
  const policy = (clause?: string) => `${ctx.service} Privacy Policy ${d.policyVersion}${clause ? `, ${clause}` : ''}`;
  const versoLabel = 'Declared';
  const said = saidOf(d);
  if (said.voice === 'theirs') {
    const from = d.findings.find((x) => x.quote.includes(said.text.replace(/…$/, '')));
    return { verso: `"${said.text}"`, versoLabel, source: from ? `${from.source}, ${said.clause ?? from.clause}` : policy(said.clause) };
  }
  // said.voice === 'ours': no sentence of theirs on file. Never put our words on the mono page, and
  // draw no asterisk: nothing has been set against anything (as in the case index).
  return { verso: 'No quotable sentence on file', versoLabel: ctx.section, mark: false, plain: true };
}

/** The file bar's reference as the card and the printed running head show it: "FILE 0042 / REV 2026-09-14". */
export const fileRefOf = (d: { fileNo?: string; date: Date; revised?: Date; draft?: string }, part?: string) =>
  `${d.fileNo ? `FILE ${d.fileNo}` : 'FILE'}${part ? ` / ${part.toUpperCase()}` : ''} / ${d.draft ? `DRAFT ${d.draft}` : `REV ${iso(d.revised ?? d.date)}`}`;

/** The publication date for the meta tags (article:published_time): none while the file is a draft. */
export const publishedOf = (d: { date: Date; draft?: string }) => (d.draft ? undefined : d.date);

/** The REV date of a file's bar: none while the file is a draft (the bar says DRAFT instead, see fileRefOf). */
export const revOf = (d: { date: Date; revised?: Date; draft?: string }) => (d.draft ? undefined : d.revised ?? d.date);

/** The left-hand reference of a file's bar: "FILE 0001", or "FILE 0001 / DRAFT 0.7.3" while it is a draft. */
export const barRefOf = (d: { fileNo: string; draft?: string }) => `FILE ${d.fileNo}${d.draft ? ` / DRAFT ${d.draft}` : ''}`;

/**
 * A published file (no `draft`) must not carry placeholders: no <Pending> or <Placeholder> in its
 * body and no `correspondencePending`. Called by the story page; fails the build.
 */
export function assertPublishable(e: { id: string; body?: string; data: { draft?: string; correspondencePending?: string } }) {
  if (e.data.draft) return;
  const found = [
    ...(/<Pending\b/.test(e.body ?? '') ? ['<Pending>'] : []),
    ...(/<Placeholder\b/.test(e.body ?? '') ? ['<Placeholder>'] : []),
    ...(e.data.correspondencePending ? ['correspondencePending'] : []),
  ];
  if (found.length)
    throw new Error(`investigations/${e.id}: published (no \`draft\`) but still has placeholders: ${found.join(', ')}; fill them or set \`draft\``);
}

/** A Reply page's card: their reply's first words facing our note on it. */
export const replyOg = (
  reply: { from: string; date: Date; text: string },
  name: string,
  note: string | undefined,
  title: string,
): OgInput => ({
  verso: `"${replyExcerpt(reply.text, 20).text}"`,
  versoLabel: 'Their reply',
  source: `${reply.from}, ${name}, ${iso(reply.date)}`,
  recto: note ?? title,
  rectoLabel: 'Our note',
});
