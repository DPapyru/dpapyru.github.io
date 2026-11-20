import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import alerts from './src/plugins/alerts.mjs';

export default defineConfig({
  site: 'https://dpapyru.github.io',
  integrations: [
    mermaid({
      theme: 'base',
      autoTheme: false,
      mermaidConfig: {
        themeVariables: {
          background: 'transparent',
          primaryColor: '#1c1526',
          primaryTextColor: '#ece7f6',
          primaryBorderColor: '#8b5cf6',
          lineColor: '#9c92b3',
          secondaryColor: '#0d0916',
          tertiaryColor: '#0d0916',
        },
      },
    }),
  ],
  markdown: {
    remarkPlugins: [alerts],
    shikiConfig: { theme: 'dracula' },
  },
});
