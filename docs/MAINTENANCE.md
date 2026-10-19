# Working notes for maintainers

termsapply.fyi: a static publication site (Astro 7, MDX, no JavaScript sent to readers) that sets
what privacy policies declare against what apps do. It holds publications and nothing else.
README.md is the full technical reference; this file holds the decisions and the working rules.

## Clean repository rule (read first, applies to every change)

Tracked files, the commit history and the build output (`dist/`) must never contain:

- personal names, or e-mail addresses of people (role addresses on the site's own domain are fine);
- home-directory paths of any system (macOS, Linux, Windows), or any other absolute local path;
- host names or addresses of a local network (private IP ranges, `.local` names);
- mentions of AI assistants: co-author trailers, lines crediting a tool with the work, names of
  models or of the companies that make them;
- metadata in images and documents: EXIF, XMP, PNG text chunks (tEXt, iTXt, zTXt, eXIf, tIME),
  PDF Author / Producer / Creator, SVG editor metadata and comments;
- time zones in commits: commit with `TZ=UTC`, so author and committer dates are `+0000`;
- references to private source repositories, earlier commits outside this repository, or the
  site's earlier domain.

Git identity is set only inside this repository (`git config user.name`, `git config user.email`),
never globally. Commit messages say what changed and nothing else: no trailers.

`npm run check:clean` enforces the rule (generic patterns in `scripts/check-clean.mjs`, plus real
names and addresses in `.check-clean.local`, which Git ignores; one pattern per line). It runs as
part of `npm run check`. Run it before every commit and before every deploy, after `npm run build`
so that `dist/` is checked too.

## Working rules

- Everything the reader sees on the site is in English, British spelling, no dashes as
  punctuation (`docs/PUBLISHING.md`).
- One commit per complete change whose checks pass. Never push or deploy without the editor's
  explicit go-ahead.
- Ask before changing fixed site text: `docs/SITE-TEXT.md` lists all of it with its source file.

## Commands

```sh
npm run check        # types and content schemas, then check:clean
npm run build        # dist/, 9 pages while empty
npm run check:links  # internal links, anchors, no external hosts (except web.archive.org links), no <script>
npm run check:og     # share images
npm run check:clean  # clean repository rule: repository files, dist/, commit history
npm run check:render # screenshots at several widths; needs Playwright, see below
npm run policy:sha   # SHA-256 of archived policy texts
```

`check:render` needs a Playwright module and a Chromium binary outside the project, given as the
environment variables `PLAYWRIGHT_MODULE` and `CHROMIUM` (README, "Stack"). Also confirm
`grep -rl "<script" dist/` and `grep -rlE "googleapis|gstatic|cdn\.|unpkg|jsdelivr" dist/` print
nothing.

Local network preview: `npx astro preview --host 0.0.0.0 --port 4321`.

## Decisions (do not undo without asking)

- **Domain** `termsapply.fyi`, written once: `DOMAIN` in `src/lib/site.ts`. Everything else
  (site URL, canonical and share URLs, robots.txt, mail addresses, printed link addresses, the
  check scripts) derives from it.
- **Section URL** `/publications/` (story, `evidence/`, `reply/`, `history/` under
  `/publications/<slug>/`). The content collection keeps its name `investigations`
  (`src/content/investigations/`); `fileHref()` in `src/lib/cases.ts` maps it to the URL.
- **Light theme only**, with a paper texture (`body::before` in `src/styles/global.css`) in the
  background colour.
- **Masthead**: wordmark, Publications, About.
- **Start page**: "Terms and conditions / are meant to be read" in two lines with the red asterisk,
  filling the first screen; the footer is below the fold.
- **Footer**: asterisk, "and verify.", our two-sentence privacy policy, "No analytics. No cookies.
  Fonts served from this domain." The "Legal notice" link appears only once a publication exists.
- **Category** (`surveillance` / `soma`) is optional. Without it nothing is printed: no label in
  the index row, the legend, the file bar or the fact grid.
- **Interval row** ("+ n days"): off, `SHOW_INTERVAL = false` in `src/lib/site.ts`.
- **Recipients** not named in a policy (`disclosed: false`) are shown on the service profile in
  ink, not red: "No" / "not listed", and a dashed line in the data-flow drawing.
- **Company replies** are printed in full with no length limit. Further messages go in
  `reply.followUps` (`date`, `text`, optional `channel`, `from`), each printed with its date.
- **A reply not yet received** is `companyReply: Awaiting` with `replyDue` (the deadline given to
  the company). Messages that only acknowledge the questions go in `acknowledgements`: printed in
  full in the "Company reply" block (ReplyPending), logged as acknowledgements, never called a
  reply, no Reply tab. With `SITE.launched` the build refuses `Awaiting` past its deadline.
- **Red on the seam only**: the asterisk on the seam of every pair is red, like the wordmark (decision of 19 Oct 2026; until then it was ink). Drawings of a file use `DataFlow neutral` and no red flows; "No" / "not listed" and the ledger stay ink. Red otherwise stays for the wordmark, the start page, the footer asterisk and link hover states.
- **Kept**: publication tabs Report / Document changes / Correspondence / Evidence / Reply / History
  (Document changes and Correspondence added 2026-10-16; a file with a correspondence has no Reply tab), service profiles, policy archive,
  corrections register, About, How to read, Legal. **Removed for good**: RSS, Decoded, Dictionary,
  Memory Hole, Tips, methodology.
- **Byline** default "termsapply". The Legal "Revised" date is `LEGAL_REVISED` in
  `src/lib/contact.ts`, changed by hand.
- **Downloads** in `public/files/` are byte for byte (`.gitattributes`: `-text`). Use a version
  folder (`public/files/<slug>/v1/`): the files are cached for 30 days, so a file is never replaced
  under the same address.

## Publishing

Content goes only in `src/content/` (plus `public/exhibits/`, `public/files/`). The writing guide is
`docs/PUBLISHING.md`; templates are in `docs/template/`. Quotes and company replies are verbatim;
no scores; the build enforces most of it.

## Open before launch

- Hosting: Cloudflare Pages (build `npm run build`; consider adding `check:links`, `check:og` and
  `check:clean` to the build command). Direct upload or a Git repository: the editor decides.
  Keep Web Analytics off in the Pages project.
- Publisher data and licence in `src/lib/contact.ts` (shown as placeholders on /legal/); set
  `SITE.launched = true` only when they are filled, or the build fails.
- Mailboxes corrections@ and contact@termsapply.fyi exist (confirmed 2026-10-11). Replies must not reveal a
  private address.
- About has only a heading and one sentence.
