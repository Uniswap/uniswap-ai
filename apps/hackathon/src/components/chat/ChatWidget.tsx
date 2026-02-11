import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import styles from './ChatWidget.module.css';

const WELCOME_MESSAGE =
  'Hi! I can answer questions about the Uniswap AI Hackathon — deadlines, categories, how to submit, and more. What would you like to know?';

function ChatIcon() {
  return (
    <svg className={styles.triggerIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C6.48 2 2 5.92 2 10.67c0 2.76 1.47 5.22 3.77 6.84-.12 1.34-.68 2.53-1.65 3.47a.5.5 0 0 0 .35.85c2.17 0 3.96-.83 5.18-1.85.77.13 1.56.2 2.35.2 5.52 0 10-3.92 10-8.67S17.52 2 12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className={styles.sendIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14.5 8L2 1.5 4.5 8 2 14.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getMessageText(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat();

  const isReady = status === 'ready';
  const isStreaming = status === 'streaming' || status === 'submitted';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !isReady) return;

    sendMessage({ text: trimmed });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      {isOpen && (
        <div className={styles.panel} role="dialog" aria-label="Hackathon AI Assistant">
          <div className={styles.header}>
            <span className={styles.headerTitle}>
              <span className={styles.headerDot} />
              Hackathon Assistant
            </span>
            <button
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 && <div className={styles.welcome}>{WELCOME_MESSAGE}</div>}

            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? styles.messageUser : styles.messageAssistant}
              >
                {getMessageText(message)}
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className={styles.streaming}>
                <span className={styles.streamingDot} />
                <span className={styles.streamingDot} />
                <span className={styles.streamingDot} />
              </div>
            )}

            {error && (
              <div className={styles.messageError}>Something went wrong. Please try again.</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className={styles.inputArea} onSubmit={handleSubmit}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the hackathon..."
              disabled={!isReady}
              aria-label="Chat message"
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!isReady || !input.trim()}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      <button
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close chat' : 'Open chat assistant'}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  );
}
