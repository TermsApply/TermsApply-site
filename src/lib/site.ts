/**
 * The site's domain: the one place it is written. Everything else derives from it: SITE.url (and
 * through it `site` in astro.config.mjs, canonical and Open Graph URLs, the sitemap, robots.txt), the
 * mail addresses in src/lib/contact.ts, the printed link addresses (Base.astro hands it to the print
 * stylesheet as --site-host). check:links and check:og read it back from the built home page.
 */
const DOMAIN = 'termsapply.fyi';

export const SITE = {
  name: 'termsapply',
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  /** The home page <title> after the name; the start page sets the same sentence in two lines. */
  motto: 'Terms and conditions are meant to be read.',
  description:
    'An independent publication documenting the gap between what privacy policies declare and what apps do.',
  /** Shown site-wide while the archive holds fictional sample content. */
  sampleNotice: false,
  /**
   * true once the real publisher data are in; the build refuses placeholders
   * when launched is true (src/lib/contact.ts, placeholders()). Independent of sampleNotice.
   */
  launched: true,
};

/** The masthead: the two links beside the wordmark. Every other page is reached from the files. */
export const NAV = [
  { href: '/publications/', label: 'Publications' },
  { href: '/about/', label: 'About' },
] as const;

/**
 * Index pages (Investigations, Services, Corrections, Archive) show this many items per page:
 * /publications/ is page 1, /publications/page/2/ the next. Below PAGE_SIZE + 1 items there is
 * no pager at all.
 */
export const PAGE_SIZE = 20;

/**
 * The interval row ("+ 33 days"), counted from the day a policy took effect to the first
 * observation (or the first day of testing): on a Declared / Observed pair and in a file's revision log. Off: nothing of it is printed. Turn it on only by an editorial decision.
 */
export const SHOW_INTERVAL = false;

/** The two editorial categories: `short` is how /how-to-read/ explains each one. */
export const CATEGORIES = {
  surveillance: {
    label: 'Surveillance',
    short: 'taken without asking',
  },
  soma: {
    label: 'Soma',
    short: 'handed over for convenience',
  },
} as const;

/** The site's own privacy policy, printed in the footer; keep it two sentences. */
export const PRIVACY_POLICY =
  'We set no cookies, run no analytics and keep no access logs; our host processes each request in order to deliver the page, and we do not read that data. If that ever changes, this paragraph changes first.';
