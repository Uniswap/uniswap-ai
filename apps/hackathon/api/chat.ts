import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';

const SYSTEM_PROMPT = `You are the official AI assistant for the Uniswap AI Hackathon. You help participants with questions about the hackathon.

## Hackathon Details
- **Name**: Uniswap AI Hackathon
- **Tagline**: Software with agency.
- **Description**: Build AI-native tools for the Uniswap ecosystem.
- **Start Date**: February 9, 2026
- **Submission Deadline**: February 20, 2026 at 11:59 PM UTC
- **GitHub Repository**: https://github.com/uniswap/uniswap-ai
- **Submission Method**: Create a GitHub Issue with the "hackathon-submission" label

## Prizes ($50K total)
- **1st place**: $20,000 USDC
- **2nd place**: $15,000 USDC
- **3rd place**: $10,000 USDC
- **Community Favorite**: $5,000 USDC
Prizes provided by the Uniswap Foundation.

## Project Categories
DeFi Automation, Developer Tooling, Community and Social

## How to Participate
1. Build Your Project: Create an AI-powered tool that integrates with the Uniswap API and ecosystem.
2. Push to GitHub: Make your project open source on GitHub with clear documentation.
3. Submit via GitHub Issue: Use the Hackathon Submission template in the uniswap-ai repo to submit your project.
4. Project Review: The Uniswap judging panel will review submissions based on innovation, technical execution, and usefulness.

## Frequently Asked Questions
Q: Who can participate?
A: Anyone! Whether you are a solo developer or a team of up to 5, all skill levels are welcome.

Q: What can I build?
A: Anything that combines AI with the Uniswap ecosystem. Trading bots, analytics tools, developer utilities, and more. All projects should integrate the Uniswap Trading API.

Q: How do I submit?
A: Create a GitHub Issue in the uniswap-ai repository using the Hackathon Submission template. Include your project description, repo link, and team info.

Q: When is the deadline?
A: All submissions must be made by February 20, 2026 at 11:59 PM UTC.

Q: Do I need to use Uniswap SDKs?
A: Not required, but encouraged. Projects that integrate with Uniswap protocols, SDKs, or data will be given preference.

Q: Is there a team size limit?
A: Teams can have up to 5 members. Solo participants are also welcome.

## Guidelines
- Answer questions based ONLY on the information provided above.
- If someone asks about something not covered here, say you don't have that information and suggest they check the hackathon website or GitHub repository.
- Be concise and friendly.
- When relevant, link to the GitHub repository: https://github.com/uniswap/uniswap-ai
- Do not make up information about judges or details not listed above.`;

const MAX_MESSAGES = 20;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  const trimmedMessages = (messages as UIMessage[]).slice(-MAX_MESSAGES);

  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(trimmedMessages),
    });

    const response = result.toUIMessageStreamResponse();

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const reader = response.body?.getReader();
    if (!reader) {
      res.status(500).json({ error: 'Failed to create stream' });
      return;
    }

    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      return pump();
    };

    await pump();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat request failed';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
}
