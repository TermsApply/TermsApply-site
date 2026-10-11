/**
 * Cross-cutting topics: a controlled list, so a topic is spelled one way and has one sentence that
 * says what it covers. Investigations carry `topics: [...]` from this list (the schema's
 * `topicEnum`); the story prints them under the byline. A topic is a subject a file is about, not a
 * verdict on the service: categories (Surveillance, Soma) stay the only verdict a file carries.
 *
 * To add a topic: append it here (slug in lowercase words joined by hyphens, label in sentence case,
 * one-sentence blurb in our voice, no dashes).
 */
import { z } from 'astro/zod';

export const TOPICS = [
  { slug: 'location', label: 'Location', blurb: 'Where you are, where you sleep and how you get between the two, read from the phone and sent on.' },
  { slug: 'health', label: 'Health', blurb: 'Heart rate, sleep, cycles and moods: readings that say more about a body than its owner would tell a stranger.' },
  { slug: 'children', label: 'Children', blurb: 'What happens to the data of people too young to agree to anything, whatever the box says.' },
  { slug: 'dark-patterns', label: 'Dark patterns', blurb: 'Screens built so that the answer the company wants is the easiest one to give.' },
  { slug: 'identifiers', label: 'Identifiers', blurb: 'The numbers that follow a phone or a person from one app, one account or one reinstall to the next.' },
  { slug: 'encryption', label: 'Encryption', blurb: 'What a promise of encryption covers, what it leaves out, and who holds the keys.' },
  { slug: 'telemetry', label: 'Telemetry', blurb: 'The quiet counts an app sends home about how it is used, often in places the user thought were private.' },
  { slug: 'third-parties', label: 'Third parties', blurb: 'The companies that receive the data without ever meeting the person it describes.' },
  { slug: 'defaults', label: 'Defaults', blurb: 'The settings that are already on when the app arrives, which most people never change.' },
  { slug: 'retention', label: 'Retention', blurb: 'How long the data is kept, and what a policy means when it says as long as necessary.' },
] as const;

export type Topic = (typeof TOPICS)[number]['slug'];

const slugs = TOPICS.map((t) => t.slug) as [Topic, ...Topic[]];

/** The schema type for a `topics` list: one of the ten slugs above. */
export const topicEnum = z.enum(slugs);

export const topicOf = (slug: Topic) => TOPICS.find((t) => t.slug === slug)!;
