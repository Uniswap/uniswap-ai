export const HACKATHON_CONFIG = {
  name: 'Uniswap AI Hackathon',
  tagline: 'Build the future of DeFi with AI',
  description:
    'Join developers, researchers, and builders to create innovative AI-powered tools for the Uniswap ecosystem.',
  deadline: '2026-02-20T23:59:59Z',
  startDate: '2026-02-09T00:00:00Z',
  github: {
    owner: 'uniswap',
    repo: 'uniswap-ai',
    submissionLabel: 'hackathon-submission',
  },
  maxDescriptionLength: 150,
} as const;

export const CATEGORIES = [
  'DeFi Automation',
  'Developer Tooling',
  'Social/Community',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const FAQ_ITEMS = [
  {
    question: 'Who can participate?',
    answer:
      'Anyone! Whether you are a solo developer or a team of up to 5, all skill levels are welcome.',
  },
  {
    question: 'What can I build?',
    answer:
      'Anything that combines AI with the Uniswap ecosystem. Trading bots, analytics tools, developer utilities, and more.',
  },
  {
    question: 'How do I submit?',
    answer:
      'Create a GitHub Issue in the uniswap-ai repository using the Hackathon Submission template. Include your project description, repo link, and team info.',
  },
  {
    question: 'When is the deadline?',
    answer: 'All submissions must be made by February 20, 2026 at 11:59 PM UTC.',
  },
  {
    question: 'Do I need to use Uniswap SDKs?',
    answer:
      'Not required, but encouraged. Projects that integrate with Uniswap protocols, SDKs, or data will be given preference.',
  },
  {
    question: 'Is there a team size limit?',
    answer: 'Teams can have up to 5 members. Solo participants are also welcome.',
  },
] as const;

export const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Build Your Project',
    description: 'Create an AI-powered tool that integrates with the Uniswap ecosystem.',
  },
  {
    step: 2,
    title: 'Push to GitHub',
    description: 'Make your project open source on GitHub with clear documentation.',
  },
  {
    step: 3,
    title: 'Submit via GitHub Issue',
    description:
      'Use the Hackathon Submission template in the uniswap-ai repo to submit your project.',
  },
  {
    step: 4,
    title: 'Get Judged',
    description:
      'Our panel will review submissions based on innovation, technical execution, and usefulness.',
  },
] as const;
