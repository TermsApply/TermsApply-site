# termsapply

**The small print, set at headline size.**

The publication template of termsapply.fyi: the layout, the visual system and the build of a
published file. It holds no content. Every folder under `src/content/` is empty (a `.gitkeep`
keeps each collection in place, and the site builds with all of them empty). The logo files are in
`design/logo/`.

The site holds publications and nothing else. A publication is the story, the evidence, the
company's reply and the history, four addresses under `/publications/<slug>/`, plus the pages
it links to: the service profile (`/services/<slug>/`), the policy archive its clauses link to
(`/archive/`), the corrections register its history links to (`/corrections/`), the key to a
file (`/how-to-read/`) and the legal notice (`/legal/`, linked from the corrections register).
The start page (`/`) is one sentence under the masthead; the masthead links to the publications
(`/publications/`) and to `/about/`. There are no feeds, no topic or category pages, and the
footer carries only "Terms apply" facing the site's privacy policy, and the colophon.

To start a file, copy the authoring templates in `docs/template/` into `src/content/`:
`service.md` into `src/content/services/<service-slug>.md`, `investigation.mdx` into
`src/content/investigations/<slug>.mdx` and `evidence.mdx` into `src/content/evidence/<slug>.mdx`.
Every value in them is a `[bracketed]` placeholder; replace each one before building (dates,
`fileNo`, `category`, `assessment`, `disclosed` and `sample` must be real values for the schema
to accept them). Together they use every component a file page uses.

## Stack

- [Astro](https://astro.build) 7, static output, Markdown + MDX content collections
- Fonts, all SIL Open Font License 1.1, self-hosted, bundled into `dist/_astro/` or served from
  `public/fonts/`; the licence texts ship as `public/fonts/LICENSE-*.txt`.
  - IBM Plex Mono (structure, labels, quoted policy text): IBM's own unmodified split woff2
    files, vendored byte-for-byte from the `@ibm/plex-mono` 2.5.0 npm package into
    `public/fonts/plex/` (`IBMPlexMono-{Regular,Medium,SemiBold}-{Latin1,Pi,Latin2,Latin3,Cyrillic}`),
    declared by hand in `src/styles/global.css` with IBM's own unicode-ranges. The package is
    not a dependency: its postinstall runs IBM Telemetry. To update the files, download the
    package once, verify with `cmp`, copy, and update the version here. IBM holds the
    Reserved Font Name "Plex" and made these subsets, so they ship as "IBM Plex Mono". Never
    re-subset or edit them: a modified Plex must be renamed (see Arrows below). Only weights
    400, 500 and 600, upright; a first visit fetches the three Latin1 files (about 53 KB).
  - Literata (headlines, prose): `@fontsource-variable/literata`.
  - "termsapply Arrows": a two-glyph cut of Plex Mono in `public/fonts/` (see Arrows below).
- `.npmrc` sets `ignore-scripts=true`: no dependency here needs an install script, and it keeps
  any future dependency from running install-time code (IBM's font package, for example, ships
  a telemetry postinstall; that is why its files are vendored instead of installed).
- Astro's own anonymous CLI telemetry is switched off in every npm script that runs Astro, with
  `ASTRO_TELEMETRY_DISABLED=1`, so a Cloudflare Pages build reports nothing to the Astro project
  either. No telemetry leaves the build machine, and nothing leaves the reader's browser.
- One stylesheet: `src/styles/global.css` (tokens, light theme only, always; a paper texture as
  inline SVG noise under the content; components, CSS-only motion)
- `@astrojs/sitemap` for `sitemap-index.xml`
- Open Graph images drawn at build time by `src/integrations/og.ts` with two devDependencies,
  `satori` (layout to SVG, pure JS) and `@resvg/resvg-js` (SVG to PNG; a prebuilt native binary
  shipped as an optional per-platform package, so it installs with `ignore-scripts=true`). See
  "Open Graph images" below.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # writes dist/
npm run check    # astro check (types and templates), then check:clean
npm run policy:sha  # SHA-256 of every archived policy text, for the `sha256` field
npm run check:og    # every page has one og:image, a 1200 x 630 PNG under 300 KB, in dist/
npm run check:links # every link, anchor and image in dist/ resolves; one h1 per page; no <script>
npm run check:render # headless Chromium: every page at 400 and 1280 px, with the system set light and dark, no overflow, no console errors
npm run check:clean # clean repository rule (docs/PUBLISHING.md): no names, local paths, LAN addresses, assistant mentions or file metadata in repository files, dist/ or commits
npm run preview  # serves dist/
```

`check:links` and `check:render` belong, with `check:og` and `check:clean`, before every push.

`check:render` needs Playwright and a Chromium outside this project (they are not dependencies):
it loads the module from the global npm root (`npm install -g playwright`, then
`npx playwright install chromium`), or from `PLAYWRIGHT_MODULE=<path to the playwright package>`,
and launches the browser at `CHROMIUM=<path to the executable>` (default `/opt/pw-browsers/chromium`).
`SHOTS=<dir>` saves a full-page screenshot of every render; `PAGES=/a/,/b/` limits the run.

## Deploy to Cloudflare Pages

| Setting | Value |
| --- | --- |
| Framework preset | Astro (or None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22, read from `.node-version` (no setting needed) |
| Environment variables | none |

`public/_headers` sets the security headers on every response: a strict Content-Security-Policy
(`script-src 'none'`, fonts and images from this origin only), `Referrer-Policy: no-referrer`,
`X-Content-Type-Options`, `Permissions-Policy` and HSTS, plus long-lived caching for the hashed
assets in `/_astro/`, and `text/plain` for the font licences and the archived policy texts.
`/robots.txt` (src/pages/robots.txt.ts) points to the sitemap. The domain is written once, as
`DOMAIN` in `src/lib/site.ts`; everything else derives from it.

## Open Graph images

Every page has its own share image, `https://termsapply.fyi/og/<route>.png`, 1200 x 630: the
facing pages on paper (light colours only; an image has no colour scheme), their sentence in IBM
Plex Mono on the left, the red six-arm asterisk in the gutter, our words in Literata on the right,
and the file bar ("FILE 0042 / REV 2026-09-14") with the wordmark at the foot. Nothing is
committed and nothing reaches readers but the PNG and its meta tags (`og:image`, its size and alt
text, `twitter:card` `summary_large_image`, `twitter:image`).

- **One source.** Each page hands its card to `Base.astro` with the `og` prop (`verso`,
  `versoLabel`, `source`, `recto`, `rectoLabel`, `mark`, `plain`) and the `fileRef` prop (the file
  bar's text), next to `title` and `description`; without them the card is the title facing the
  description. A card's labels are its page's labels (round 5). There are two kinds:
  - **A pair**: the page's own pair labels over both pages, uppercase and tracked ("DECLARED /
    OBSERVED" on a story, "THEIR REPLY / OUR NOTE"
    on a Reply page, "WHAT IT COLLECTS / WHAT LEAVES THE DEVICE" on a service profile), their
    sentence with its source line under it in sentence case ("Example Notes Privacy Policy v4.2,
    §3.1"), ours facing it. Investigations use their quotable sentence (`pull`, else the first
    finding's quote trimmed to about 20 words; `fileOgVerso()` in `src/lib/cases.ts`) facing the
    headline. A service profile sets the
    first phrase of `declaredCollects` against the first line of `observedLeaves`, with the
    asterisk only when `observedFile` is set ("Not captured yet." otherwise), and its bar carries
    the REV, as on the page. An archived version sets its title line, the 404 its composite. The
    asterisk sits level with the middle of the taller page, label to last line, inside the page
    area.
  - **A plain card** (`plain`, the default when `verso` is not a quote): the section name alone on
    the left (`versoLabel`), set like the file bar (Plex Mono SemiBold, uppercase, tracked, about 28
    px, ink), never at quote size; on the right, under "THIS SITE", the page name (`verso`) as a
    Literata 600 headline above the description (`recto`). No asterisk. Indexes, How to read,
    Legal, the archive index and service groups, and a file with nothing of theirs on file
    ("No quotable sentence on file"; our words are never set in mono).
- **How it is built.** During `astro build` (never in dev), Base records each card as JSON in
  `node_modules/.astro/og-cards/`; when the build is done, the `termsapply-og` integration draws
  them with satori and resvg into `dist/og/`. Route to file: the path without slashes plus
  `.png`, `/` is `og/index.png`, `/publications/<slug>/evidence/` is
  `og/publications/<slug>/evidence.png` (`ogImagePath()` in `src/lib/og.ts`).
- **Fitting.** Sentences are trimmed to about 28 words, then set at the largest size that fits
  their page (Plex Mono is exactly 0.6 em a character; Literata is estimated wide), with
  hyphenated compounds kept on one line. A word longer than a line breaks rather than overflow.
- **Fonts** are in `scripts/og-fonts/` because satori reads TTF, OTF and WOFF but not WOFF2:
  `IBMPlexMono-{Regular,Medium,SemiBold}.woff`, IBM's own unmodified complete WOFF files from the
  same `@ibm/plex-mono` 2.5.0 package as `public/fonts/plex/` (so they keep the name "IBM Plex
  Mono": nothing was converted, subset or renamed), and `literata-latin-{400,600}-normal.woff`
  from `@fontsource/literata` 5.3.0 (static instances; satori cannot set a variable font). Both
  licences sit beside them. They are used only at build time and are not served.
- **Drawings.** The wordmark and the asterisk come from `design/logo/wordmark-inline.svg` and
  `design/logo/asterisk.svg`: these two files in `design/` are build inputs, not mockups, and a
  cleanup of `design/` must keep them.
- **Check.** `npm run check:og` reads every HTML page in `dist/`: exactly one `og:image`, on this
  domain under `/og/`, width and height tags of 1200 and 630, an alt text, the large Twitter card;
  the file exists, is a PNG whose IHDR says 1200 x 630, and is under 300 KB; no unused PNGs. The
  link check (`check:links`) also resolves every `og:image` URL.

## Printing

`@media print` in `src/styles/global.css` turns a page into a file on paper: white paper, black
ink (print tokens in the print block), the red kept for the asterisk and the discrepancy marks
(`print-color-adjust: exact`). The masthead sections, the sample notice, the tab row, the pager,
and the skip link are left out; the file bar, the facing pages
and the colophon stay. The printer's own paper size is used (only the margins are set), and pairs
stay side by side at A4 and Letter widths: every pair rule written "from 48rem" also applies in
print. Links print their address after the words in small mono, internal ones as
`termsapply.fyi/…` (not the wordmark, the footnote asterisk, category labels, topic links, the
exhibit links in a pair's label row, or anchors on the same page). The CSS motion (the asterisk
settling, the highlight drawing in) is screen only, so a PDF made straight after load prints both
finished. Exhibits, pairs, diffs and boxes do not split
across sheets; a closed technical appendix prints open. Diagrams (inline SVG) always print. An
image exhibit is `loading="lazy"`, and a lazy image prints only once it has loaded: a reader who
wants the exhibits on paper scrolls through the evidence page before printing (a headless
`page.pdf()` of an unscrolled page prints a lazy image as an empty frame). An image that must always
print takes the `eager` prop on its `<Exhibit>` (`loading="eager"`, loaded with the page). Every sheet has a running head with the
page's address and its file reference (`fileRef`): on the first sheet Base's `.print-head` line
prints the address only (the file bar under it prints the reference); on later sheets the same two strings are in the page's top margin boxes, filled by a small
inline print-only `<style>` in Base (Chromium 131 and later; other browsers print the head on the
first sheet only). A `position: fixed` head was tried and dropped: it repeats, but overlaps the
text of every sheet after the first.

## Content model

All content lives in `src/content/`; schemas are in `src/content.config.ts`. They are the schemas
of the source repository, unchanged, so a file written there builds here as it is.

| Collection | Folder | What it is |
| --- | --- | --- |
| `investigations` | `investigations/*.md(x)` | Long-form files: file number, service, policy version, test window, category, `topics`, company reply, `findings` (Declared/Observed pairs), `related` |
| `evidence` | `evidence/*.mdx` | The evidence for one investigation: `file` (the investigation's slug), optional `captures` (device, OS, app build, from, to) and `summary`; the MDX body holds the exhibits, the data flow and the technical appendix |
| `services` | `services/*.md` | Service profiles: platforms, what it collects (`declaredCollects`, the policy's own list, verbatim, facing `observedLeaves`, what the evidence of `observedFile` shows leaving the device; or `collects`, our summary list), who receives it (disclosed or not) |
| `policies` | `policies/*.md` + `policies/text/*.txt` | The policy archive: one archived version of one document each (service, document, version, effective and retrieval dates, source URL, SHA-256); the full text is the `.txt` named in `text`, published byte for byte. `npm run policy:sha` prints the checksum |
| `corrections` | `corrections/*.md` | The corrections register: `CR-nnnn`, the file corrected, the sentence as published (`was`) and as corrected (`now`), why, and who reported it |


Two optional editorial categories can tag a file: **Surveillance** (taken without asking, ink) and
**Soma** (handed over for convenience, khaki). There are no scores or ratings. The definitions are
`CATEGORIES` in `src/lib/site.ts`; the label is plain text.
**Topics** are a controlled list of ten in `src/lib/topics.ts`; a file carries one to four
(`topics: [telemetry, identifiers]`) and the story prints them under the byline, as text.

**Pagination.** The Investigations, Services, Corrections and Archive indexes show `PAGE_SIZE`
items (20, in `src/lib/site.ts`) per page: `/publications/` is page 1, `/publications/page/2/`
the next (there is never a `/page/1/`), fed by `paginatePaths()` in `src/lib/cases.ts`. With
PAGE_SIZE items or fewer there is no pager. An empty index says "No files yet."

Every investigation is one file at four addresses, linked by a tab row under the file bar:

| Address | Built from | What it holds |
| --- | --- | --- |
| `/publications/<slug>/` | `investigations/<slug>.md(x)` | The story: head pair, headline, fact grid, body, further findings, "What this means for you", related files |
| `/publications/<slug>/evidence/` | `evidence/<slug>.mdx` | Capture metadata, the exhibits (`#exh-1`, `#exh-2`, …), the data flow, the technical appendix. Only built when the evidence file exists; without it the file has no Evidence tab |
| `/publications/<slug>/reply/` | the file's `reply` and `replyNote` | The company's reply in full, in mono, facing our note. Only built when `reply` exists; the tab sits between Evidence and History |
| `/publications/<slug>/history/` | the corrections register and the file's frontmatter | The file's own revision log, with its corrections (always built) |


In a story written as `.mdx`, the body can place components without importing them: `<Note>`,
`<Finding finding={props.findings[1]} />`, `<ExhibitRef>`, `<ForReaders>`. In an evidence file:
`<Note>`, `<Exhibit>`, `<DataFlow>`, `<RoundTrip>`, `<Timeline>`, `<TechnicalAppendix>`. Anything
the story does not place (findings, reader advice from `means`) is added after it, so plain `.md`
stories get the full layout too; a `.md` story with an evidence file gets a short "Evidence on
file" list. See the header comment in each file in `src/components/`, and `docs/template/` for a
complete example.

## Content: adding an investigation

1. Add the service first, if it is new: copy `docs/template/service.md` to
   `src/content/services/<slug>.md` (name, kind, platforms, what it collects, and its recipients,
   each with `disclosed: true | false`).
2. Copy `docs/template/investigation.mdx` to `src/content/investigations/<slug>.mdx` (or write a
   `.md` if the body needs no components).
   The file name becomes the URL: `/publications/<slug>/`.
3. Copy `docs/template/evidence.mdx` to `src/content/evidence/<slug>.mdx` with `file: <slug>` in its frontmatter
   (see "Evidence" below). It is published at `/publications/<slug>/evidence/`.
4. Fill in the frontmatter, write the story and the evidence, run `npm run check` and `npm run build`.

### Frontmatter

| Field | Required | What it is |
| --- | --- | --- |
| `title` | yes | The headline. Hyphenated compounds never break across lines. |
| `dek` | yes | One or two sentences under the headline; also the meta description. |
| `summary` | no | One line for the case index; falls back to `dek`. |
| `pull` | no | One quotable policy sentence, verbatim, about 20 words or fewer. It is the left page of the file's case-index row and, when it is part of the first finding's `quote`, the sentence set at display size in the head pair. Without it, both use `findings[0].quote`, trimmed to about 20 words for the index. |
| `pullClause` | no | The clause of `pull` (`"§5"`) when the sentence is not taken from one of the findings; otherwise the clause comes from the finding that contains it. |
| `date` | yes | Publication date, `YYYY-MM-DD`. |
| `revised` | no | Date of the latest revision or correction; shown as `REV` in the file header. Set it to the newest correction's date or later (not enforced by the build). |
| `service` | yes | Slug of a file in `src/content/services/`. |
| `category` | no | `surveillance` (taken without asking) or `soma` (handed over for convenience). Without it no category label is printed (index row, legend, file bar, fact grid). |
| `topics` | no | One to four slugs from `src/lib/topics.ts`: `[encryption, third-parties, identifiers]`. |
| `fileNo` | yes | Four digits, quoted: `"0043"`. Never reuse a number. |
| `policyVersion`, `policyDate` | yes | The policy version the findings quote, and the date it took effect. |
| `policyPrev` | no | The previous version, as text: `v4.1, 2026-02-10`. |
| `testedFrom`, `testedTo` | yes | The test window. |
| `platforms` | yes | List of OS versions or devices tested: `[iOS 18.6, Android 15]`. |
| `appVersions` | no | App builds tested, as text. |
| `companyAsked` | no | Date the findings were sent to the company. |
| `companyReply` | yes | The status line, one of `None`, `Declined`, `Replied YYYY-MM-DD` (the build rejects anything else). `Replied` must carry the date of `reply.date`; `None` with a `reply` fails the build. The file header turns it into "No reply within five working days" (counted from `companyAsked` to `date`), "Declined YYYY-MM-DD" or "Replied YYYY-MM-DD". |
| `reply` | no | The reply in full: `{ date, channel, from, text, attachment?, followUps? }`. See "Company replies". |
| `replyNote` | no | Our one paragraph beside the reply: what it does and does not address. |
| `byline` | no | Defaults to `termsapply`. |
| `sample` | yes | `true` for a fictional sample file, `false` for a real one. |
| `readingTime` | no | Minutes; computed from the body if left out. |
| `findings` | no | List of Declared / Observed pairs (below). |
| `related` | no | List of `{ collection: investigations, id: <slug> }`. |


### Services: what it collects

| Field | Required | What it is |
| --- | --- | --- |
| `collects` | no | Our summary list. Shown, beside "Who receives it", only when there is no `declaredCollects`. |
| `declaredCollects` | no | The policy's own list of what it collects, phrase by phrase, verbatim: the left page of the profile's pair "What it collects / What leaves the device". Each phrase must appear word for word in the privacy-policy text we hold or quote for the service: the newest archived version of its Privacy Policy, or the findings of our investigations. A phrase found in none fails the build, and so does a `declaredCollects` on a service with none of these on file. |
| `collectsClause` | no | Where that list is in the policy, `"§2"`. |
| `observedLeaves` | no | What our captures saw leave the device, one plain sentence each, saying only what the evidence of `observedFile` shows: the right page. Without it the right page says the app has not been captured yet, and there is no asterisk. |
| `observedFile` | with `observedLeaves` | The investigation (slug) whose evidence page shows those lines. The build fails if it is missing, is about another service, or has no evidence file; the right page links to its evidence page. |
| `observedNote` | no | Where the observed lines come from: the file, the dates, the devices, the exhibit. |

### Evidence (MDX)

The story and the evidence are two files. The evidence file's frontmatter:

| Field | Required | What it is |
| --- | --- | --- |
| `file` | yes | Slug of the investigation it supports. One evidence file per investigation. |
| `captures` | no | One row per device: `{ device: iPhone 13, os: iOS 18.6, app: 6.3.1 (6312), from: 2026-09-02, to: 2026-09-11 }`. Printed as the capture table, first under the head of the Evidence page; below 640 px each device is one ruled entry (name, then system / build / dates) that wraps instead of scrolling. |
| `summary` | no | One or two sentences under the "Evidence" headline. |

Number exhibits in the order they appear, and refer to them in the story with `<ExhibitRef>` and
in each finding's `evidenceRef` ("Exh. 1", which then links to the exhibit).

- **Request log.** Define the log as a top-level export, then pass it in (text inside a JSX
  attribute loses indentation):

  ```mdx
  export const exhibit1Log = `
  # capture: iPhone 13 / iOS 18.6 / app 6.3.1 / times UTC
  21:03:09.886  !!POST  spell.example/v1/check!!  200  0.6 KB
                {"text": "… ==heliotrope-7741==", …}
  `;

  <Exhibit n={1} caption="requests from one note edit, 3 Sep 2026, 21:03 UTC" meta="log excerpt" log={exhibit1Log} />
  ```

  Mini-markup: a line starting with `#` is a comment, `==text==` is highlighted (canaries, IDs),
  `!!text!!` is red (the offending request), `~~text~~` is muted.
- **Described screenshot.** `<Exhibit n={2} caption="…" shot={{ alt, before, rows, after }} />`.
  `alt` is required and is what screen readers hear.
- **Data flow.** Put a `<DataFlow>` inside an `<Exhibit>` so it gets a numbered caption.
  Recipients with `disclosed: false` are drawn dashed red with a red half-barb head (with the
  `neutral` prop, as the service profile uses it: dashed in ink, no red); "disclosed"
  means named in the policy's recipient list or a sub-processor list it links to, on the capture
  date.

  ```mdx
  <Exhibit n={3} caption="where text from the editor goes, 2–11 Sep 2026" meta="drawn from Exhibit 1">
    <DataFlow
      app="Example Notes"
      origin={{ name: 'Editor', sub: 'what you type' }}
      recipients={[
        { name: 'sync.notes.example', disclosed: true, data: 'note text', via: { name: 'Encryption', sub: 'on device', data: 'ciphertext' } },
        { name: 'spell.lexiconcloud.example', disclosed: false, data: 'draft text + install ID' },
      ]}
    />
  </Exhibit>
  ```

- **Screenshot as a file.** `<Exhibit n={4} caption="…" meta="…" image={{ src, alt, width, height }}
  redactions="test account name, one ink rectangle" />`. Put the file in `public/exhibits/`, PNG or SVG; `width` and `height` are its own pixels. The frame hugs the image
  and never exceeds the column; the image is never filtered. With
  `redactions`, a mono line "Redactions: …" closes the caption. The image loads lazily; add
  `eager` when it must always print (see Printing). Follow "Screenshots and redaction"
  below.
- **Timeline and round trip.** `<Timeline points span>` draws one device's runs in order;
  `<RoundTrip app service legs>` draws an exchange there and back. Put each inside an
  `<Exhibit>`, like a data flow; `docs/template/evidence.mdx` has both.
- **Technical appendix.** End with `<TechnicalAppendix>` for devices, builds, capture setup,
  tables and steps to reproduce.

Each exhibit is anchored `#exh-<n>`. In the story, put `<ExhibitRef n={1} label="requests from one
note edit" />` on its own line where the exhibit belongs: it renders a mono row, "Exhibit 1 /
requests from one note edit →", linking to `/publications/<slug>/evidence/#exh-1`. The build
fails if the evidence file has no exhibit with that number.

Margin notes go immediately before the paragraph they annotate, in either file:
`<Note>**§3.1** / policy v4.2</Note>`.

Names seen in an app or its traffic (fields, parameters, identifiers) are written in backticks,
`` `demandScore` ``, and set in mono on a tone of paper: in MDX bodies, and in the plain-text fields
of our own words (`dek`, `summary`, `observed`, `evidence`, `means`, `replyNote`, the service's
`collects`, `observedLeaves`, `observedNote`) through `src/components/Inline.astro`. Meta tags and
share cards drop the backticks (`plain()` in `src/lib/format.ts`). Never in a title or in their words.

### Files on record (downloads)

A file's captures and scripts, pseudonymised, go in `public/files/<slug>/` and are served byte for
byte at `/files/<slug>/<name>` (Cloudflare Pages serves `public/` as is; `public/_headers` marks
`/files/*` as attachments with a long cache and keeps them out of search). List them on the
evidence page with the SHA-256 of each file as served, and keep the originals' checksums in a
separate file next to them. Limits: Cloudflare Pages serves no single file over 25 MiB, and Git LFS
objects are not fetched by its build, so split anything larger and commit the pieces as plain
files. The repository is public: whatever goes into `public/files/` is public, and stays in the
history after removal, so pseudonymise and review before the first commit.

### Screenshots and redaction

A screenshot is evidence, so it is published as the app showed it, with one exception: whatever
identifies a person, or one of our test accounts, is painted over first.

- **What we paint over:** account names, e-mail addresses, phone numbers, faces, device
  identifiers (serial numbers, advertising IDs), and anything else that identifies a person or a
  test account. An identifier that is itself the finding stays visible when it belongs to a test device we
  reset afterwards, and the caption says so.
- **With what:** an opaque rectangle in the ink colour (#16140F), covering the whole item. Never a
  blur and never pixelation: both can be reversed.
- **How it is marked:** every redaction is listed in the exhibit's `redactions` prop, printed as
  "Redactions: …" under the caption (what was covered, and with what). The rectangle is not
  disguised as part of the interface.
- **What we never do:** change any other pixel (no retouching, no recolouring), or crop out context
  that changes what the screen says. Any crop is stated in the caption.
- **Files:** PNG or SVG, metadata removed before upload (EXIF, location, device model, editing
  history; for example `exiftool -all= file.png`, or an export that writes none; an SVG carries no
  `<metadata>` and no editor comments). The capture time stays in the caption, in UTC.

### Company replies

Every file records what the company said, in two fields. `companyReply` is the status line in the
file header and the revision log. `reply` is the reply itself, word for word:

| Field | Required | What it is |
| --- | --- | --- |
| `date` | yes | The day it arrived, `YYYY-MM-DD`. |
| `channel` | yes | How it came: `email`, `press office form`, `letter`. |
| `from` | yes | A name or a function: `Head of Privacy`, `Press office`. |
| `text` | yes | Their words, exactly as sent. Blank lines part paragraphs and line breaks are kept; nothing else (no Markdown) is interpreted, so the reply is printed as received. |
| `attachment` | no | A path on this site, e.g. `/exhibits/<name>-reply.pdf` (upload it to `public/exhibits/`). |
| `followUps` | no | Every further message from the company, in the order received: a list of `{ date, text, channel?, from? }`, each `text` verbatim like the first. `channel` and `from` default to the first message's. The build fails if they are out of date order. |

Every message is printed in full, whatever its length; there is no word limit.

With a `reply`, the file gets a Reply tab and page (their reply in mono on the left with its source
line; on the right, what we asked and when, from `companyAsked`, and `replyNote`), a "Company reply"
block after the story with the first 40 words and a link to the page, and a line in the revision log,
"Reply received from <from> by <channel>.", plus one line per further message, "Further message
received from <from> by <channel>." A refusal is a reply too: `companyReply: Declined` with
the refusal in `reply.text`. No reply at all is `companyReply: None` and no `reply`; the header then
says "No reply within five working days" when the file was published at least five working days
after `companyAsked`.

### Findings

Page labels come in one family of pairs, named on `/how-to-read/`: findings are "Declared /
Observed" (story, the profile's findings from investigations, the how-to-read examples);
the profile's own pair is "What it collects / What leaves the device". A share card prints the
labels of its page's lead pair (see "Open Graph images").

Each finding is one Declared / Observed pair, in the frontmatter `findings` list:

| Field | What it is |
| --- | --- |
| `clause`, `clauseTitle` | `"§3.1"` and the clause's own heading. |
| `source` | Document and version: `Example Notes Privacy Policy v4.2`. |
| `quote` | The policy sentence, verbatim. Never paraphrase. |
| `mark` | A phrase inside `quote` to highlight. The build fails if it is not found word for word. |
| `effective`, `retrieved` | Date the quoted version took effect, and the date we archived it. |
| `observed` | What we saw, in one or two plain sentences. |
| `observedAt` | Optional. First day the behaviour was seen, `YYYY-MM-DD`. With `effective` (or the file's `policyDate`) it gives the interval row between the two pages, "+ 33 days", counted in whole days; without it the interval runs to `testedFrom`. The row is printed only when `SHOW_INTERVAL` in `src/lib/site.ts` is true (default false). Keep it consistent with the date in `evidence`. |
| `evidence`, `evidenceRef` | The supporting line (`40 of 40 canaries… / iOS 18.6 / 2026-09-03`) and exhibit reference (`Exh. 1`). |
| `means` | "What this means for you", in plain language. |
| `assessment` | Optional. `parts` (the observation departs from the wording), `interpretation` (it depends on how the wording is read) or `agrees` (consistent). Printed as a word under the right page's label (never red); a consistent pair keeps the same layout and size but no asterisk in the gutter. Without it the pair is drawn as before. |

The first finding is the file's head pair: it is set under the file bar, above the headline, as
their sentence (or `pull`) facing our observation, with the interval row. It is printed once. Do not repeat it in the body: neither
re-quote its sentence nor restate its observation in a paragraph, and do not place it a second
time. A `<Finding finding={props.findings[0]} />` left in an `.mdx` body renders nothing, so older
files keep working. Place later findings with `<Finding finding={props.findings[1]} />` and so on.
Findings the body does not place are added after it, and their `means` lines become the "What
this means for you" box unless the body has its own `<ForReaders>`.

### Arrows

The "→" in links and notes is IBM Plex Mono's own glyph, served from the arrow-only subsets in
`public/fonts/termsapply-arrows-{400,500,600}.woff2` (U+2190 and U+2192 only, under 1 KB each;
`@font-face` at the top of `src/styles/global.css`, first in the `--mono` stack). They were cut from
the OFL Plex Mono with
`pyftsubset --unicodes=U+2190,U+2192 --flavor=woff2 --layout-features='' --no-hinting`. Type the
arrow as text; nothing else is needed.

IBM's licence declares "Plex" a Reserved Font Name, and a subset is a Modified Version (OFL FAQ
2.6), so the subsets are renamed "termsapply Arrows" inside the font (name IDs 1, 3, 4, 6, 16, 17)
and in CSS; the IBM copyright and the OFL notice stay in name IDs 0, 13 and 14. If you cut a new
subset, rename it the same way and never ship a modified font under a name containing "Plex".

## Editorial rules

- **Publication rule.** A finding is published only when the behaviour was seen on at least two
  test devices, on at least two different days, and the company was sent the findings in writing
  with at least five working days to answer. Set `companyAsked` and `companyReply`, and put the
  company's reply in full in `reply`. A late reply is added with its date, and `revised` changes.
- **No scores.** No numbers, stars, grades or rankings for services, anywhere: not in
  frontmatter, copy, titles or images. The `category` tag (when set) and the evidence are the only verdict.
- **Fictional samples.** Sample content uses invented services and `.example` hosts. Never
  attach an invented finding to a real company, product or domain.
- **Quotes are verbatim.** Policy text is quoted exactly, with document, version and dates.
  Keep the archived copy and its SHA-256 checksum in the policy archive (`src/content/policies/`).
- **Corrections in the open.** A correction updates `revised`, is entered in the corrections
  register (`src/content/corrections/`), and so appears at /corrections/ and in the file's revision
  log. Never edit a published sentence silently.
- **No intent, no personal data.** Report what the policy says and what the app did, not why.
  Nothing personal from a capture is published.

## No JavaScript, no tracking

- No JavaScript is served to readers. No client components, no analytics, no tag managers,
  no theme toggle (light only), no third-party embeds. The CSP enforces it
  with `script-src 'none'`.
- No cookies, no external requests: fonts, icons and styles are served from this domain.
  The fonts come from `public/fonts/` (IBM Plex Mono, the Arrows cut) and npm
  (`@fontsource-variable/literata`), never from Google Fonts at runtime, and the CSP's `font-src 'self'` would
  block any font from another host.
- Motion is CSS only and every piece is disabled under `prefers-reduced-motion: reduce`.
- The site's privacy policy is two sentences long (`PRIVACY_POLICY` in `src/lib/site.ts`). If
  it ever changes, it changes there first.

Before merging, check that `grep -rl "<script" dist/` and
`grep -rlE "googleapis|gstatic|cdn\.|unpkg|jsdelivr" dist/` both print nothing, and run
`npm run check`, `npm run build`, `npm run check:links`, `npm run check:render`,
`npm run check:og` and `npm run check:clean`.
