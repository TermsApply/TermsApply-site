/**
 * /archive/<service>/<document>/<version>/<text file>: the archived policy text as we saved it,
 * byte for byte (the Response body is the file's own Buffer; nothing is decoded or re-encoded), so
 * its SHA-256 equals the one printed on the version page. Served as text/plain; charset=utf-8 by
 * the `/archive/*.txt` rule in public/_headers.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getPolicies, type ArchivedPolicy } from '../../../../../lib/archive';

export const getStaticPaths = (async () => {
  const policies = await getPolicies();
  return policies.map((p) => ({
    params: { service: p.serviceId, document: p.documentSlug, version: p.version, file: p.textFile.replace(/\.txt$/, '') },
    props: { policy: p },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { policy } = props as { policy: ArchivedPolicy };
  return new Response(new Uint8Array(policy.bytes), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
