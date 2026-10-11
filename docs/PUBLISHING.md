# Publishing a file: instructions for the agent

You assemble one publication (an investigation) from the material the editor gives you. You write
content files only. The site's fixed text, layout and code are out of scope: they are listed in
`docs/SITE-TEXT.md` so you know what is already on the page and do not repeat it.

## Clean repository rule

Applies to every file you add, every commit and every build. Tracked files, the commit history and
`dist/` must never contain:

- personal names, or e-mail addresses of people (role addresses on the site's own domain are fine);
- home-directory paths of any system (macOS, Linux, Windows), or any other absolute local path;
- host names or addresses of a local network (private IP ranges, `.local` names);
- mentions of AI assistants: co-author trailers, lines crediting a tool with the work, names of
  models or of the companies that make them;
- metadata in images and documents: EXIF, XMP, PNG text chunks (tEXt, iTXt, zTXt, eXIf, tIME),
  PDF Author / Producer / Creator, SVG editor metadata and comments. Strip it before a file goes
  into `public/exhibits/` or `public/files/`;
- time zones in commits: commit with `TZ=UTC`, so author and committer dates are `+0000`;
- references to private source repositories, earlier commits outside this repository, or the
  site's earlier domain.

Git identity is set only inside this repository (`git config user.name`, `git config user.email`),
never globally. Commit messages say what changed and nothing else: no trailers.

`npm run check:clean` enforces the rule: generic patterns in `scripts/check-clean.mjs`, plus real
names and addresses in `.check-clean.local` (ignored by Git, one pattern per line). It also runs as
part of `npm run check`. Run it after `npm run build`, so `dist/` is checked too.

## Rules that are not negotiable

- **Verbatim.** Every policy sentence (`quote`, `pull`, `declaredCollects`, the archived `.txt`)
  is copied character for character from the document. Never fix, shorten or paraphrase it. The
  build checks `mark` against `quote`, `pull` against the first quote, `declaredCollects` against
  the archived text and findings, and the `.txt` against its `sha256`.
- **The company's reply is verbatim too**: `reply.text` and every `reply.followUps[].text` exactly as
  received, in full, whatever the length.
- **No scores, grades, stars or rankings** anywhere. The category (when set) and the evidence are
  the only verdict.
- **No intent.** Report what the policy says and what the app did, never why.
- **No personal data.** Screenshots are redacted by the rules in README "Screenshots and
  redaction"; every redaction is listed in the exhibit's `redactions`.
- **Publication rule.** A finding needs at least two test devices, at least two different days,
  and the findings sent to the company in writing with at least five working days to answer.
  If the material does not show this, stop and tell the editor.
- **Do not invent.** A value you do not have is left out (optional fields) or asked for
  (required fields). Never fill a required field with a guess.
- Text the reader sees is in **English**, British spelling, no dashes as punctuation.
- **Names from the app in backticks.** Every field, parameter, key, header or identifier seen in
  the app or its traffic is written in backticks: `` `demandScore` ``, `` `$adId` ``,
  `` `install_id` ``. The page sets it in mono on a tone of paper. This works in the MDX body and
  in these frontmatter fields: `dek`, `summary`, `observed`, `evidence`, `means`, `replyNote`,
  evidence `summary`, service `collects`, `observedLeaves`, `observedNote`. Never in `title`, and
  never inside text that is theirs (`quote`, `pull`, `declaredCollects`, `reply.text`): those stay
  exactly as written.
- Do not edit anything outside `src/content/` and `public/exhibits/`, `public/files/`. Do not
  commit or push unless the editor asks.

## What you need from the editor

1. The service: name, what kind of app it is, platforms.
2. The policy text as retrieved (plain text), its URL, the date it took effect, the date it was
   retrieved, the version.
3. The findings: for each, the clause and its heading, the sentence, what was observed, the first
   day it was seen, the counts, devices and days, the exhibit numbers.
4. Captures: devices, OS versions, app builds, first and last day; logs, screenshots, drawings.
5. Dates: test window, the day the findings were sent to the company, publication date.
6. The company's reply, if any (date, channel, sender, full text), and our note on it.
7. File number (four digits, never used before), category (optional), one to four topics.

## Files to create, in this order

The slug is the URL name: lowercase words joined by hyphens, e.g. `quill-notes-spellcheck`.

| # | Copy | To | Publishes |
| --- | --- | --- | --- |
| 1 | `docs/template/service.md` | `src/content/services/<service-slug>.md` | `/services/<service-slug>/` (skip if the service exists) |
| 2 | `docs/template/policy.md` + the raw text | `src/content/policies/<entry>.md` and `src/content/policies/text/<entry>.txt` | `/archive/<service-slug>/<documentSlug>/<version>/` |
| 3 | `docs/template/investigation.mdx` | `src/content/investigations/<slug>.mdx` | `/publications/<slug>/` plus `history/`, and `reply/` when there is a reply |
| 4 | `docs/template/evidence.mdx` | `src/content/evidence/<slug>.mdx` | `/publications/<slug>/evidence/` |
| 5 | screenshots, attachments | `public/exhibits/<name>` | `/exhibits/<name>` |
| 6 | captures, scripts (pseudonymised) | `public/files/<slug>/<name>` | `/files/<slug>/<name>` (downloads) |

The policy `<entry>` name is `<service-slug>--<documentSlug>--<version with dots as hyphens>`,
e.g. `quill-notes--privacy-policy--v4-2`. After saving the `.txt`, run `npm run policy:sha` and
copy the printed checksum into `sha256`.

Every `[bracketed]` value in a template is a placeholder: replace it or delete the line. Dates are
`YYYY-MM-DD`. `true` / `false` are written without quotes. `fileNo` stays in quotes (`"0001"`).

## Where each field shows up

### Service (`src/content/services/<service-slug>.md`)

| Field | Required | Shown as |
| --- | --- | --- |
| `name` | yes | Profile heading, every mention of the service, file bar "PUBLICATIONS / NAME" |
| `slug` | yes | Same as the file name |
| `kind` | yes | Under the name in fact grids ("note-taking app"); "A <kind>. Nothing observed on file yet." |
| `platforms` | yes | Profile fact grid "Platforms", Services index meta line |
| `collects` | no | "What it collects" list, our words; used only without `declaredCollects` |
| `declaredCollects`, `collectsClause` | no | Left page "What it collects": the policy's own list, verbatim, with its clause |
| `observedLeaves`, `observedFile`, `observedNote` | no | Right page "What leaves the device", only what the evidence of `observedFile` shows |
| `recipients` | no | "Who receives it" table and the data-flow drawing; `name` may be "Host (detail)"; `disclosed: false` prints "No" / "not listed" and a dashed line, in ink, not red; `where` is the clause ("§7") |
| body | no | One paragraph under the profile's dek |

### Policy archive entry (`src/content/policies/<entry>.md`)

| Field | Required | Shown as |
| --- | --- | --- |
| `service` | yes | Service slug |
| `document`, `documentSlug` | yes | "Privacy Policy" / `privacy-policy` (URL) |
| `version` | yes | "v4.2", also the last URL segment; same spelling as `policyVersion` in the file |
| `effectiveDate`, `retrievedAt` | eff. no, retr. yes | "Effective", "Retrieved" |
| `sha256` | yes | Printed in full; the build fails if the `.txt` does not match |
| `sourceUrl` | no | Printed as text, never as a link |
| `text` | yes | File name of the `.txt`. Blank lines part paragraphs; numbered headings ("3.1 Your content") become anchors `#s-3-1` |

### Investigation (`src/content/investigations/<slug>.mdx`)

| Field | Required | Shown as |
| --- | --- | --- |
| `title` | yes | Headline; over-line on Evidence, Reply, History; browser tab; right page of the index row |
| `dek` | yes | One or two sentences under the headline; search description |
| `summary` | no | Services index when there is no finding; falls back to `dek` |
| `pull` | no | About 20 words, verbatim, part of `findings[0].quote`: set large at the head and on the index row |
| `pullClause` | no | Clause of `pull` when it is not from a finding |
| `date` | yes | "Published <date>"; index date; revision log |
| `revised` | no | "REV" in the file bar, "Revised" in the byline; set it on every correction |
| `service` | yes | Service slug |
| `category` | no | `surveillance` or `soma`; leave out to print no category label (list, file bar, fact grid) |
| `topics` | no | One to four from `src/lib/topics.ts`, printed under the byline |
| `fileNo` | yes | "FILE 0001" everywhere; never reuse |
| `policyVersion`, `policyDate` | yes | Fact grid "Policy v4.2, eff. <date>"; Evidence byline; revision log |
| `policyPrev` | no | "prev. v4.1, 2026-02-10" |
| `testedFrom`, `testedTo` | yes | "Tested <range>"; revision log |
| `platforms` | yes | Fact grid "Platforms tested" (first two, the rest below); "Testing begins on …" |
| `appVersions` | no | Fact grid "App versions"; several separated by `;` |
| `companyAsked` | no | "Company asked <date>"; "What we asked" on the Reply page; revision log |
| `companyReply` | yes | `None`, `Declined` or `Replied YYYY-MM-DD` (date of `reply.date`) |
| `reply` | no | Reply tab and page, teaser after the story: `date`, `channel`, `from`, `text`, `attachment` (`/exhibits/…`); further messages in `followUps` (`date`, `text`, optional `channel`, `from`), each printed in full with its date |
| `replyNote` | no | "What it does and does not address" on the Reply page |
| `byline` | no | Bold at the start of the byline; default "termsapply" |
| `sample` | yes | `false` for every real file |
| `readingTime` | no | Leave out: computed |
| `findings` | no | Declared / Observed pairs (below) |
| `related` | no | "Related cases": `{ collection: investigations, id: <slug> }` |

**Findings.** `findings[0]` is the head pair, printed once above the headline; never repeat its
sentence or observation in the body. Place the others in the body with
`<Finding finding={props.findings[1]} />`. Per finding: `clause` ("§3.1"), `clauseTitle`,
`source` ("<Service> Privacy Policy v4.2"), `quote` (verbatim), `mark` (a phrase inside `quote`),
`effective`, `retrieved`, `observed` (one or two plain sentences, ours), `observedAt` (first day
seen; gives "+ n days" only when `SHOW_INTERVAL` in `src/lib/site.ts` is on), `evidence` ("40 of 40 notes / 2 phones / 2 days"), `evidenceRef`
("Exh. 1", links to the exhibit), `means` (plain advice, used when the body has no
`<ForReaders>`), `assessment` (`parts`, `interpretation` or `agrees`).

**Story body (MDX).** Available without imports: `<Note>` (margin note, placed right before its
paragraph), `<Finding>`, `<ExhibitRef n={1} label="…" />`, `<ForReaders>` (the "What this means
for you" box, a bullet list inside), `<Diff>`, `<CategoryTag>`, `<Asterisk>`. Headings are `##`.
`docs/template/investigation.mdx` shows the order.

### Evidence (`src/content/evidence/<slug>.mdx`)

| Field | Required | Shown as |
| --- | --- | --- |
| `file` | yes | The investigation slug |
| `summary` | no | Dek under "Evidence" |
| `captures` | no | "Capture" table: `device`, `os`, `app`, `from`, `to` |

Body components: `<Note>`, `<Exhibit>` (with `log`, `shot`, `image` + `redactions`, or a drawing
inside), `<DataFlow>`, `<Timeline>`, `<RoundTrip>`, `<TechnicalAppendix>`, `<Diff>`. Number
exhibits 1, 2, 3 in order of appearance; the story's `<ExhibitRef n>` and each `evidenceRef` must
point at an exhibit that exists. Logs are top-level `export const …Log = \`…\`` strings with the
mini-markup `# comment`, `==highlight==`, `!!red request!!`, `~~muted~~`. The template
`docs/template/evidence.mdx` and README "Evidence (MDX)" show each form.

### Correction (later, `src/content/corrections/CR-<nnnn>.md`)

Copy `docs/template/correction.md`. `now` must appear word for word in the corrected file, and the
file's `revised` is set to the correction date or later. Never change a published sentence without
a correction entry.

## Check before you hand back

Run, in the project folder, and report the output:

```
npm run check
npm run build
npm run check:links
npm run check:og
npm run check:clean
```

All five must end with 0 errors / 0 problems. Then open the pages (`npm run preview`) and confirm:
the head pair reads correctly, every exhibit link lands on its exhibit, the tabs show Evidence
(and Reply, if there is one), the footer now shows "Legal notice".

Hand back a list of: files created, every value you left out and why, anything in the material
that did not meet the publication rule.
