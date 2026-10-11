# Fixed text on the site

Every piece of text a visitor can see that is written into the code, not into a publication.
Grouped by where it appears; each group names the file that holds it. Text in `<angle brackets>`
is filled in from a publication (see `docs/PUBLISHING.md`). Changing anything here is a code
change, not a publishing step.

## Every page

**Masthead** (`src/components/Masthead.astro`, `Wordmark.astro`, `src/lib/site.ts` NAV)

- Wordmark: the word "termsapply" with the red asterisk, drawn as an image; links to the start
  page. Screen readers hear "termsapply home".
- Navigation: **Publications** (to /publications/), **About** (to /about/), one row at every
  width.
- Sample notice bar, off (`SITE.sampleNotice = false`): "Sample edition / All services and findings
  on this site are fictional samples."

**Footer** (`src/components/Footer.astro`, `src/lib/site.ts` PRIVACY_POLICY)

- Left page: the red asterisk, then "for everyone." (on the start page: "and verify.").
- Right page, labelled "Our privacy policy" / "In full": "We set no cookies, run no analytics and
  keep no access logs; our host processes each request in order to deliver the page, and we do not
  read that data. If that ever changes, this paragraph changes first."
- Colophon: "Fonts served from this domain."
- "Legal notice" link (to /legal/).

**Browser tab and search snippets** (`src/layouts/Base.astro`, `src/lib/site.ts`)

- Start page tab: "termsapply: Terms and conditions are meant to be read."
- Every other tab: "<page title> / termsapply".
- Default description (search results): "An independent publication documenting the gap
  between what privacy policies declare and what apps do."
- Share images (`/og/*.png`) are drawn from each page's title and labels; no extra text.

**Printing**: every internal link is followed by its address, "(termsapply.fyi/…)".

## Start page `/` (`src/pages/index.astro`)

- "Terms and conditions / are meant to be read" in two lines, ending on the red asterisk.

## Publications `/publications/` (`src/pages/publications/[...page].astro`, `CaseIndex.astro`)

- File bar: "PUBLICATIONS / <n> FILE(S)", right side: newest date and category counts.
- Heading **Publications**. Dek: "What privacy policies say and what apps do, with the evidence: recorded traffic, embedded code and settings."
- Empty: "No files yet."
- Legend under the list: "Left page: their words, verbatim. Right page: our file. Surveillance:
  taken without asking. Soma: handed over for convenience."
- Each row: left page `"<pull or first quote>" <clause>`, right page `<title>`, meta line
  `<fileNo> / <service> / <Category>` and `<date>`.
- Pager (over 20 files): "← Previous", "Page <n> of <m>", "Next →".

## One publication: shared parts (`FileHeader.astro`, `FileTabs.astro`)

- File bar: "FILE <fileNo> / REV <date>", right side "PUBLICATIONS / <SERVICE NAME>" and the
  category label.
- Tabs: **Story**, **Evidence** (only with an evidence file), **Reply** (only with a reply),
  **History**; link "How to read this file".
- Back link at the foot of Evidence, Reply, History: "← Back to the story".

## Story `/publications/<slug>/` (`[slug]/index.astro`, `DeclaredObserved.astro`, `src/lib/cases.ts`)

- Pair labels: **Declared** (left), **Observed** (right); interval row "+ <n> days" only when
  `SHOW_INTERVAL` in `src/lib/site.ts` is true (default false).
- Assessment words under "Observed": "Departs from the wording", "Open to interpretation",
  "Consistent".
- Byline: "<byline> / Published <date> / Revised <date> / <n> correction(s) / Tested <range> /
  <n> min read". Default byline: "termsapply".
- "Topics" followed by topic names.
- Fact grid labels: **Service**, **Platforms tested**, **App versions** (or **Tested**),
  **Policy** ("<version>, eff. <date>", "prev. …"), **Category**, **Status**
  ("Company asked <date>").
- Status phrases: "No reply", "No reply within five working days", "No reply at publication, <n>
  working days after asking", "Declined", "Declined to comment", "Declined <date>",
  "Replied <date>".
- Reply teaser: "Company reply", the first 40 words, "<from>, <service> / by <channel> / <date>",
  link "Read the reply in full →" or "The reply, with our note →".
- "Evidence on file" (a list, only when the story places no exhibit links).
- Exhibit link: "Exhibit <n> / <label> →".
- Box: "For readers" / **What this means for you**.
- "Related cases".

## Evidence `/publications/<slug>/evidence/` (`evidence.astro`, `Exhibit.astro`, `TechnicalAppendix.astro`)

- Heading **Evidence**; default dek when there is no summary: "The exhibits, the data flow and the
  technical appendix for file <fileNo>: <title>".
- Byline: "<n> exhibit(s) / Tested <range> / <n> platform(s) / policy <version>, eff. <date>".
- **Capture** table: Device, System, App build, From, To.
- Exhibit captions: "Exhibit <n> / <caption>", "Redactions: <…>".
- Appendix default title: "Technical appendix".

## Reply `/publications/<slug>/reply/` (`reply.astro`, `CompanyReply.astro`)

- Heading **Reply**. Dek: "<Service>’s reply to file <fileNo>, received <date>, printed in full,
  and our note on what it addresses." (declined: "<Service> declined to comment on file <fileNo>.
  Its reply of <date>, in full, and our note.")
- Left page **Their reply**: "<from>, <service> / by <channel> / <date>", "Printed in full, as
  received[, with <n> further message(s)].", "Attachment: <file>". Each further message under
  "Further message [from <from>] / by <channel> / <date>".
- Right page **Our note**: "What we asked": "We sent our findings to <service> in writing on
  <date>, with the evidence and our questions, and gave the company at least five working days to
  answer. The reply came on the <ordinal> working day after that." / "The company declined to
  comment." Then "What it does and does not address" and our note.

## History `/publications/<slug>/history/` (`history.astro`, `RevisionLog.astro`, `investigationLog` in `src/lib/cases.ts`)

- Heading **History**. Dek: "The revision log of file <fileNo>: what happened, when, and every
  correction."
- **Revision log / file <fileNo>**, lines generated from the publication:
  "Policy <prev> takes effect: the version before the one examined." /
  "Policy <version> takes effect: the version this file examines." /
  "Testing begins on <platforms>." / "First observation: <observed>" ["+ <n> days after <version>
  took effect", only with `SHOW_INTERVAL`] / "Findings sent to <service> in writing." / "Testing ends." /
  "Reply received from <from> by <channel>[, after publication]." /
  "Further message received from <from> by <channel>[, after publication]." /
  "File <fileNo> published, with no reply from <service> [within five working days] | after
  <service> declined to comment | with <service>’s reply printed in full." /
  "File <fileNo> revised." / "Correction CR-<nnnn>: <why>".

## Services `/services/` and `/services/<slug>/` (`src/pages/services/`)

- Index heading **Services**; dek "Every service we have filed on: the sentence its policy leads
  with, and what we found."; "No policy sentence on file yet."; "A <kind>. Nothing observed on file
  yet."; "no files yet"; legend "Left page: the sentence the policy leads with, from our newest file
  on the service. Right page: what we found."
- Profile dek: "What <name> collects, who receives it, and where its privacy policy and its
  behaviour part ways."
- Fact grid: **Service**, **Platforms**, **Policy** ("newest version on file" / "not yet read"),
  **Earlier versions** ("none on file"), **Files**, **Archived texts**.
- Sections: "What it collects, and what leaves the device" (labels **What it collects** / **What
  leaves the device**; "Not captured yet. We have read this policy but have not run the app through
  our capture, so nothing is set against the list."), or "What it collects"; "Who receives it"
  (Recipient, Role, Disclosed Yes/No, Where; "no clause given", "not listed"; "<n> recipient(s)
  is/are not named in the policy.", no red); data-flow exhibit "where data from <name> goes. Solid
  line: disclosed in the policy. Dashed line: not named in the policy." (dashed in ink, not red) / "drawn from the table above"; "What the
  policy says, and what we found"; "Files on this service" ("All files →"); "Policy versions on
  file" ("Archive →"). Empty: "Nothing recorded yet.", "No findings filed on <name> yet.", "No files
  on <name> yet.", "No <name> policy text archived yet."

## Policy archive `/archive/…` (`src/pages/archive/`, `ArchiveRows.astro`)

- Heading **Policy archive**; dek "Every version of the policies we quote, kept in full as we
  retrieved them, with the date, the source and a SHA-256 checksum."; intro paragraph ("Each
  document is shown as retrieved on the date given. …"); "Nothing archived yet."
- Per service: "<name>: policies on file", "<name> profile / All services in the archive".
- Per version: fact grid Service, Document, Version, Retrieved ("as retrieved on this
  date"), Source ("as text: this site links to no other host"), Plain text, SHA-256 ("of the
  plain-text file, checked at every build"); "Versions on file"; "The text, as retrieved";
  "End of <document> <version> / SHA-256 <hash>"; "← All <name> documents on file".
- Rows: "Effective <date>", "Archived <date>. Follows <version>. / The oldest version on file.
  Quoted in file <n>.", "SHA-256 <short>", "Plain text, <n> bytes".

## Corrections `/corrections/` (`src/pages/corrections/[...page].astro`)

- Heading **Corrections**; dek "Every correction to a file we have published: the sentence as it
  was, the sentence as it is now, and why."; intro "We do not change a published sentence silently.
  …"; "In the register: <n> corrections / <n> files / How to ask for a correction"; labels **As
  published** / **As corrected**; "Reported by <who>"; "No corrections yet."

## How to read `/how-to-read/` (`src/pages/how-to-read/index.astro`)

Entirely fixed text with composite examples: sections "Two pages", "The asterisk", "Exhibits",
"One file, several pages", "File number and REV", "Corrections". Byline "termsapply / Examples: composites".

## Legal notice `/legal/` (`src/pages/legal/index.astro`, `src/lib/contact.ts`)

- Sections: Publisher (Publisher, Region, Contact), Corrections, Right of reply (printed in full, every message with its date), Hosting and data, Licence of the content.
- Unknown publisher data print as "[PLACEHOLDER: …]" until filled in `src/lib/contact.ts`.
- Byline "termsapply / Revised <LEGAL_REVISED>" (the date is set by hand in
  `src/lib/contact.ts`).
- Addresses: corrections@termsapply.fyi, contact@termsapply.fyi.

## About `/about/` (`src/pages/about/index.astro`)

- Heading **About**. Dek: "Just a few curious people from the internet." Then "You can write to us
  at contact@termsapply.fyi."

## Not found `/404.html` (`src/pages/404.astro`)

- Bar "ERROR 404 / NOT IN THE ARCHIVE"; left page "The record says": "This page has been
  rectified."; right page "What happened": "The address you followed is not in the archive. It may
  have been mistyped, or the file may have moved. We do not take files down quietly: if one is
  ever withdrawn, we say so, with the date."; links "Home page", "Publications".

## Controlled lists (choose from, do not invent)

**Categories** (`src/lib/site.ts`): `surveillance` = Surveillance, "taken without asking";
`soma` = Soma, "handed over for convenience".

**Topics** (`src/lib/topics.ts`): `location`, `health`, `children`, `dark-patterns`,
`identifiers`, `encryption`, `telemetry`, `third-parties`, `defaults`, `retention`.
