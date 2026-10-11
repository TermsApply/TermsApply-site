/**
 * The publisher's details, printed on /legal/.
 *
 * Every value that is not known yet is `null`, and the page prints it as a mono marker,
 * "[PLACEHOLDER: …]" (Placeholder.astro), never as an invented value. `placeholders()` names what
 * is still missing, and the build fails if any of it remains once SITE.launched is true, so an
 * empty publisher line cannot go out with the real site.
 */
import { SITE } from './site';

/** The corrections desk, named on /legal/ and the corrections register. */
export const CORRECTIONS_EMAIL = `corrections@${SITE.domain}`;

/**
 * The publisher, as printed on /legal/#publisher: name, region and contact. `null` prints "[PLACEHOLDER: <what>]". `email`
 * is a real address on this domain; `emailConfirmed` stays false until the mailbox exists.
 */
export const PUBLISHER = {
  name: 'termsapply' as string | null,
  /** Where the editors are: printed as "Region" on /legal/. */
  region: 'European Union' as string | null,
  email: `contact@${SITE.domain}`,
  emailConfirmed: true,
  /** Where the host keeps the site, if the collective sets a data region. Optional: null prints
   *  "The host's data region is not set." on /legal/, and is not a placeholder. */
  hostingRegion: null as string | null,
  /** The licence of our own words, once the collective has decided. null: placeholder. */
  licence: 'Our own words, the findings, notes and corrections, are published under the Creative Commons Attribution 4.0 International licence (CC BY 4.0): anyone may copy and adapt them with credit to termsapply and a link to the file.' as string | null,
};

/** The date /legal/ prints as "Revised". Change it by hand whenever the legal notice changes. */
export const LEGAL_REVISED = '2026-10-11';

/** What is still a placeholder on /legal/. */
function placeholders() {
  const missing: string[] = [];
  for (const k of ['name', 'region', 'licence'] as const) {
    if (!PUBLISHER[k]) missing.push(`PUBLISHER.${k}`);
  }
  if (!PUBLISHER.emailConfirmed) missing.push('PUBLISHER.emailConfirmed');
  return missing;
}

/** Called by /legal/: placeholders are allowed only until SITE.launched is true. */
export function assertLaunchReady() {
  const missing = placeholders();
  if (SITE.launched && missing.length) {
    throw new Error(`SITE.launched is true, but these are still placeholders in src/lib/contact.ts: ${missing.join(', ')}`);
  }
  return missing;
}
