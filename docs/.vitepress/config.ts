import { defineConfig } from 'vitepress';

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
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/' },
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Quick Start', link: '/getting-started/quick-start' },
          ],
        },
      ],
      '/skills/': [
        {
          text: 'Skills',
          items: [
            { text: 'Overview', link: '/skills/' },
            { text: 'Aggregator Hook Creator', link: '/skills/aggregator-hook-creator' },
          ],
        },
      ],
      '/evals/': [
        {
          text: 'Evals',
          items: [
            { text: 'Overview', link: '/evals/' },
            { text: 'Writing Evals', link: '/evals/writing-evals' },
            { text: 'Running Evals', link: '/evals/running-evals' },
          ],
        },
      ],
    },

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
