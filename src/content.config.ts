import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { topicEnum } from './lib/topics.ts';

const category = z.enum(['surveillance', 'soma']);
const byline = z.string().default('termsapply');

/**
 * One Declared / Observed pair. The first pair of an investigation leads on the home page and heads
 * the file. `effective` (or the piece's policyDate) and `observedAt` (or testedFrom) give the
 * interval row ("+ 33 days") between the two pages.
 */
const finding = z.object({
  clause: z.string(), // "§3.1"
  clauseTitle: z.string().optional(), // "Your content"
  source: z.string(), // "Quill Notes Privacy Policy v4.2"
  quote: z.string(), // the policy sentence, verbatim
  mark: z.string().optional(), // phrase inside `quote` to highlight
  effective: z.coerce.date().optional(),
  retrieved: z.coerce.date().optional(),
  observed: z.string(),
  observedAt: z.coerce.date().optional(), // first day the behaviour was seen; falls back to testedFrom
  evidence: z.string().optional(),
  evidenceRef: z.string().optional(), // "Exh. 1"
  means: z.string().optional(), // "What this means for you"
  /** How the two pages stand to each other, as a word, never a score: `parts` (the observation
      departs from the wording), `interpretation` (it depends on how the wording is read), `agrees`
      (consistent: no asterisk in the gutter, the two pages do not part). Without it the pair is
      drawn as before, with the asterisk and no label. */
  assessment: z.enum(['parts', 'interpretation', 'agrees']).optional(),
});

/**
 * The company's reply, printed in full on the file's Reply page (/<collection>/<slug>/reply/).
 * `text` is their words, verbatim: paragraphs separated by blank lines, line breaks kept, nothing
 * else interpreted. `attachment` is a path on this site (e.g. /exhibits/hearth-reply.pdf).
 * `companyReply` stays the one-line status ("None", "Awaiting", "Declined", "Replied YYYY-MM-DD") and carries
 * the date of the first message. `followUps` holds every further message from the company, in the
 * order received, each verbatim with its own date; `channel` and `from` default to the first
 * message's. Every message is printed in full: there is no length limit.
 */
const followUp = z.object({
  date: z.coerce.date(),
  channel: z.string().optional(),
  from: z.string().optional(),
  text: z.string(),
});
/**
 * Messages that acknowledge the questions without answering them ("we'll get back to you"), received
 * while a reply is still awaited (`companyReply: "Awaiting"`). Printed in full, each with its date,
 * on the story under "Company reply"; never called a reply, and the file has no Reply page for them.
 */
const acknowledgement = z.object({
  date: z.coerce.date(),
  time: z.string().optional(), // "17:36 CEST (15:36 UTC)", printed in the history after the channel
  channel: z.string(),
  from: z.string(),
  text: z.string(),
});
/** The deadline given to the company for its reply, while `companyReply` is "Awaiting". */
const replyDue = z.object({
  date: z.coerce.date(),
  time: z.string().optional(), // "23:59 CEST", printed after the date
});
const reply = z
  .object({
    date: z.coerce.date(),
    channel: z.string(), // "email", "press office form", "letter"
    from: z.string(), // a name or a function: "Head of Privacy"
    text: z.string(),
    attachment: z.string().regex(/^\/[^\s]*$/).optional(),
    followUps: z.array(followUp).default([]),
  })
  .refine((r) => r.followUps.every((m, i, all) => m.date >= (i ? all[i - 1].date : r.date)), {
    message: 'reply.followUps must be in date order, none before reply.date',
  });

/**
 * The whole correspondence about a file, message by message, printed in full and in order on the
 * file's Correspondence page (/<collection>/<slug>/correspondence/). Both sides: `side` "ours" for
 * messages from the authors, "theirs" for the company's. `sent` is the moment of sending in UTC,
 * "2026-10-02T07:50Z", or a bare date "2026-10-08" when the time is not on record; it is printed in
 * Central European time with UTC beside it. `text` is the message verbatim (paragraphs separated by
 * blank lines, line breaks kept); when the full text is not on record, `summary` holds our account
 * of it instead and is printed as such. No e-mail addresses in `from`. A file with a correspondence
 * has no separate Reply page: the company's messages are here. Texts may be YAML anchors that
 * `reply`, `reply.followUps` and `acknowledgements` reuse (*alias), so each message is written once.
 * `note` is our remark on a message, printed under it, outside the message and labelled as ours, so
 * that "each in full and unchanged" stays true of `text`. Printed by the Correspondence page.
 */
const message = z
  .object({
    sent: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}Z)?$/),
    side: z.enum(['ours', 'theirs']),
    from: z.string().refine((v) => !/\S@\S/.test(v), { message: 'no e-mail addresses in `from`' }),
    channel: z.string().default('email'),
    subject: z.string().optional(),
    text: z.string().optional(),
    summary: z.string().optional(),
    note: z.string().optional(),
    gist: z.string().optional(), // our words, a few of them, for the history line of this message
  })
  .refine((m) => Boolean(m.text) !== Boolean(m.summary), { message: 'a message has either `text` or `summary`' });

/**
 * Company documents that changed while the file was prepared, each version printed in full on the
 * file's Document changes page (/<collection>/<slug>/documents/), the later version's added words
 * marked mechanically (src/lib/textdiff.ts). `text` and `pdf` are paths under public/files/<slug>/, read
 * at build time; `headings` names the lines of `text` that are headings in the original page.
 * Snapshot addresses are printed in full and linked: web.archive.org is the only other host the
 * site links to (scripts/check-links.mjs).
 */
const docVersion = z.object({
  label: z.string(), // "Last Update: 9 May 2024", as the document dates itself
  status: z.string(), // our words: "In force during the study (reference state, 8 Oct 2026)"
  text: z.string().regex(/^v\d+\/[^\s]+\.txt$/),
  textFrom: z.string(), // our words: where the text was taken from
  headings: z.array(z.string()).default([]),
  pdf: z.string().regex(/^v\d+\/[^\s]+\.pdf$/).optional(),
  pdfSaved: z.coerce.date().optional(),
  snapshot: z.object({ url: z.string().regex(/^https:\/\/web\.archive\.org\/web\/\d{14}\//), note: z.string().optional() }).optional(),
});
const changedDocument = z.object({
  title: z.string(),
  address: z.string(), // where the company publishes it, printed as text
  changed: z.string(), // our words: when it changed, as far as known
  versions: z.tuple([docVersion, docVersion]), // earlier, later
});

/** Cross-cutting topics: one to four slugs from the controlled list in src/lib/topics.ts (TOPICS). */
const topics = z.array(topicEnum).max(4).default([]);

/** Pointer to another file, for "Related" lists. */
const related = z.object({
  collection: z.enum(['investigations']),
  id: z.string(),
});

const investigations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/investigations' }),
  schema: z.object({
    title: z.string(),
    dek: z.string(),
    summary: z.string().optional(), // one line for the case index; falls back to dek
    /** One quotable policy sentence of about 20 words, verbatim. Index rows and display spreads use
        it; without it they take findings[0].quote, trimmed to about 20 words. */
    pull: z.string().optional(),
    pullClause: z.string().optional(), // clause of `pull` when it is not taken from a finding
    date: z.coerce.date(),
    revised: z.coerce.date().optional(),
    /** Set while the file is not yet published: the draft's label ("0.7.3"). The file then says
        "Draft <label>, not published" instead of "Published <date>", carries no publication time in
        its meta tags, and its history logs the draft instead of a publication; `date` is the date
        of the draft. Without `draft` the file is published on `date`, and the build refuses
        placeholders in it (<Pending>, <Placeholder>, `correspondencePending`). */
    draft: z.string().optional(),
    /** Set when access to the file was restricted at publication (on `date`) and opened to everyone
        later: public access from this date, with an optional time ("06:00 CEST (04:00 UTC)").
        The history logs the publication as online for the company only until then, and a further
        line on this date. */
    publicFrom: z.object({ date: z.coerce.date(), time: z.string().optional() }).optional(),
    service: reference('services'),
    category: category.optional(), // optional: without it no category label is printed anywhere
    topics,
    fileNo: z.string().regex(/^\d{4}$/),
    policyVersion: z.string(),
    policyDate: z.coerce.date(),
    policyPrev: z.string().optional(), // "v4.1, 2026-02-10"
    /** A later version of the policy that the file also examines (published after testing), in the
        form of policyPrev: "v4.3, 2026-11-02". Logged in the history as such. */
    policyLater: z.string().optional(),
    /** Ids of other archived texts the file quotes (src/content/policies/<id>.md), beyond the policy
        version it examines; the archive lists the file under "Quoted in" on each of them. */
    archiveQuoted: z.array(z.string()).default([]),
    testedFrom: z.coerce.date(),
    testedTo: z.coerce.date(),
    platforms: z.array(z.string()),
    appVersions: z.string().optional(),
    companyReply: z.string().regex(/^(None|Awaiting|Declined|Replied \d{4}-\d{2}-\d{2})$/), // "None", "Awaiting", "Declined", "Replied 2026-09-10"
    companyAsked: z.coerce.date().optional(),
    replyDue: replyDue.optional(), // required with companyReply "Awaiting"
    acknowledgements: z.array(acknowledgement).default([]),
    reply: reply.optional(),
    correspondence: z.array(message).default([]),
    /** A message still to come, printed at the end of the correspondence as not yet available. */
    correspondencePending: z.string().optional(),
    /** Our two or three sentences at the head of the Document changes page. */
    documentsIntro: z.string().optional(),
    documents: z.array(changedDocument).default([]),
    replyNote: z.string().optional(), // our one-paragraph comment on the reply, on the Reply page
    byline,
    sample: z.boolean(),
    readingTime: z.number().int().positive().optional(),
    findings: z.array(finding).default([]),
    related: z.array(related).default([]),
  }),
});

/**
 * The evidence for one investigation, written as its own file and published at
 * /publications/<slug>/evidence/. Keyed by `file` (the investigation's slug); name the file after
 * it too. The MDX body holds the exhibits (<Exhibit>, <DataFlow> inside one) and the
 * <TechnicalAppendix>; the story refers to them with <ExhibitRef n={1} />. An investigation with
 * no evidence file has no Evidence tab and no evidence page.
 */
const evidence = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/evidence' }),
  schema: z.object({
    file: reference('investigations'),
    /** One row per device in the capture: "iPhone 13", "iOS 18.6", "6.3.1 (6312)", first and last day. */
    captures: z
      .array(
        z.object({
          device: z.string(),
          os: z.string(),
          app: z.string(),
          from: z.coerce.date(),
          to: z.coerce.date(),
        }),
      )
      .optional(),
    summary: z.string().optional(), // one or two sentences under the "Evidence" headline
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    kind: z.string(),
    platforms: z.array(z.string()),
    site: z.url().optional(),
    policyUrl: z.url().optional(),
    collects: z.array(z.string()).default([]), // our summary list, shown when there is no pair below
    /** The profile's pair "What it collects" / "What leaves the device". `declaredCollects`: the
        policy's own list, phrases verbatim, each checked at build time against the policy text we
        hold or quote (src/pages/services/[slug].astro); `collectsClause` its clause ("§2").
        `observedLeaves`: what our captures saw leave the device, in our words, and only what a
        published file's evidence shows; `observedFile` names that investigation (it must be about
        this service and have an evidence page, or the build fails); `observedNote` says which
        captures, which exhibit. */
    declaredCollects: z.array(z.string()).optional(),
    collectsClause: z.string().optional(),
    observedLeaves: z.array(z.string()).optional(),
    observedFile: reference('investigations').optional(),
    observedNote: z.string().optional(),
    recipients: z
      .array(
        z.object({
          name: z.string(),
          role: z.string(),
          disclosed: z.boolean(),
          where: z.string().optional(), // "§7"
        }),
      )
      .default([]),
  }),
});

/**
 * The policy archive: one entry per archived version of one document, published at
 * /archive/<service>/<documentSlug>/<version>/ with the raw text as a download next to it. The text
 * itself is a plain .txt file in src/content/policies/text/ (`text` is its file name), served byte
 * for byte; `sha256` is its checksum (npm run policy:sha prints it) and the build fails when the
 * two disagree. Name the entry and the .txt <service>--<documentSlug>--<version with dots as
 * hyphens>, e.g. quill-notes--privacy-policy--v4-2.
 */
const policies = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/policies' }),
  schema: z.object({
    service: reference('services'),
    document: z.string(), // "Privacy Policy"
    documentSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), // "privacy-policy", for the URL
    version: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/), // "v4.2"; also the last URL segment
    effectiveDate: z.coerce.date().optional(),
    retrievedAt: z.coerce.date(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    sourceUrl: z.url().optional(),
    text: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.txt$/), // file name in src/content/policies/text/
    /** Our words: where the text was taken from, when that matters to a reader comparing copies
        (e.g. a browser PDF rather than the page itself). Printed in the fact grid as "Text from". */
    textFrom: z.string().optional(),
  }),
});

/**
 * The corrections register (/corrections/): one entry per correction to one of our files. `was` is
 * the sentence as published, `now` the sentence as it reads today (the build fails if `now` is not
 * in the file), `why` the reason. Each correction is also merged into the corrected file's revision
 * log; set the file's `revised` to the correction date or later.
 */
const corrections = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/corrections' }),
  schema: z.object({
    id: z.string().regex(/^CR-\d{4}$/),
    date: z.coerce.date(),
    file: z.object({
      collection: z.enum(['investigations']),
      id: z.string(),
    }),
    where: z.string().optional(), // which part of the file: "Story, second paragraph", "§3.1"
    was: z.string(),
    now: z.string(),
    why: z.string(),
    reportedBy: z.string(), // "a reader", "the company", "the collective", or a role
  }),
});

export const collections = { investigations, evidence, services, policies, corrections };
