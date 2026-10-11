// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
// Open Graph cards: Base.astro records each page's card during the build; this draws dist/og/*.png.
import og from './src/integrations/og.ts';
import { SITE } from './src/lib/site.ts';

export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [mdx(), sitemap(), og()],
  // Nothing interactive ships to readers; keep the dev toolbar out of the way too.
  devToolbar: { enabled: false },
});
