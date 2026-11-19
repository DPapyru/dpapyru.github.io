import { defineConfig } from 'astro/config';
import alerts from './src/plugins/alerts.mjs';

export default defineConfig({
  site: 'https://dpapyru.github.io',
  markdown: {
    remarkPlugins: [alerts],
    shikiConfig: { theme: 'dracula' },
  },
});
