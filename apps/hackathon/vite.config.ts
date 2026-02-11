import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Dev-only plugin that handles POST /api/chat requests.
 * In production, the Vercel serverless function at api/chat.ts handles this.
 */
function chatApiPlugin(): Plugin {
  let apiKey: string | undefined;

  return {
    name: 'chat-api-dev',
    apply: 'serve',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      apiKey = env.OPENAI_API_KEY;
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url !== '/api/chat' || req.method !== 'POST') {
            return next();
          }

          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }

          try {
            const { messages } = JSON.parse(body);
            if (!Array.isArray(messages) || messages.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Messages array is required' }));
              return;
            }

            const { CHATBOT_SYSTEM_PROMPT } = (await server.ssrLoadModule(
              './src/lib/chatbot-prompt.ts'
            )) as { CHATBOT_SYSTEM_PROMPT: string };

            const { streamText, convertToModelMessages } = await import('ai');
            const { createOpenAI } = await import('@ai-sdk/openai');

            const openai = createOpenAI({ apiKey });
            const result = streamText({
              model: openai('gpt-4o-mini'),
              system: CHATBOT_SYSTEM_PROMPT,
              messages: await convertToModelMessages(messages.slice(-20)),
            });

            const response = result.toUIMessageStreamResponse();

            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              headers[key] = value;
            });
            res.writeHead(response.status, headers);

            const reader = response.body?.getReader();
            if (reader) {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
            }
            res.end();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Chat request failed';
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: message }));
            }
          }
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), chatApiPlugin()],
  server: {
    port: 3000,
  },
});
