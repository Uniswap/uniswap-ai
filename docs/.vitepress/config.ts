import path from 'node:path';
import { defineConfig } from 'vitepress';
import { generateSidebar } from './sidebar';

const docsDir = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  title: 'Uniswap AI',
  description: 'AI tools for building on the Uniswap protocol',

  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'Evals', link: '/evals/' },
      { text: 'API', link: '/api/' },
    ],

    sidebar: generateSidebar(docsDir),

    socialLinks: [{ icon: 'github', link: 'https://github.com/uniswap/uniswap-ai' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-2026 Uniswap Labs',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/uniswap/uniswap-ai/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    // Enable Solidity syntax highlighting via Shiki
    languages: ['solidity', 'typescript', 'javascript', 'json', 'bash', 'yaml'],
  },
});
