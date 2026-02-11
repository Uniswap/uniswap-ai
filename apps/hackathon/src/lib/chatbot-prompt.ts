import { HACKATHON_CONFIG, FAQ_ITEMS, HOW_TO_STEPS, CATEGORIES, PRIZES } from './config';

const faqSection = FAQ_ITEMS.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n');

const stepsSection = HOW_TO_STEPS.map(
  (step) => `${step.step}. ${step.title}: ${step.description}`
).join('\n');

const categoriesSection = CATEGORIES.join(', ');

const prizesSection = PRIZES.map((p) => `- **${p.place}**: ${p.amount}`).join('\n');

const deadline = new Date(HACKATHON_CONFIG.deadline).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

const startDate = new Date(HACKATHON_CONFIG.startDate).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export const CHATBOT_SYSTEM_PROMPT = `You are the official AI assistant for the ${HACKATHON_CONFIG.name}. You help participants with questions about the hackathon.

## Hackathon Details
- **Name**: ${HACKATHON_CONFIG.name}
- **Tagline**: ${HACKATHON_CONFIG.tagline}
- **Description**: ${HACKATHON_CONFIG.description}
- **Start Date**: ${startDate}
- **Submission Deadline**: ${deadline}
- **GitHub Repository**: https://github.com/${HACKATHON_CONFIG.github.owner}/${HACKATHON_CONFIG.github.repo}
- **Submission Method**: Create a GitHub Issue with the "${HACKATHON_CONFIG.github.submissionLabel}" label

## Prizes ($50K total)
${prizesSection}
Prizes provided by the Uniswap Foundation.

## Project Categories
${categoriesSection}

## How to Participate
${stepsSection}

## Frequently Asked Questions
${faqSection}

## Guidelines
- Answer questions based ONLY on the information provided above.
- If someone asks about something not covered here, say you don't have that information and suggest they check the hackathon website or GitHub repository.
- Be concise and friendly.
- When relevant, link to the GitHub repository: https://github.com/${HACKATHON_CONFIG.github.owner}/${HACKATHON_CONFIG.github.repo}
- Do not make up information about prizes, judges, or details not listed above.`;
