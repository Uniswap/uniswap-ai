import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { toggleVote } from '../../lib/forum';
import styles from './UpvoteButton.module.css';

interface UpvoteButtonProps {
  targetType: 'post' | 'comment';
  targetId: string;
  count: number;
  hasUpvoted: boolean;
}

export function UpvoteButton({ targetType, targetId, count, hasUpvoted }: UpvoteButtonProps) {
  const { user, configured } = useAuth();
  const [voted, setVoted] = useState(hasUpvoted);
  const [displayCount, setDisplayCount] = useState(count);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!user || !configured || loading) return;

    setLoading(true);
    try {
      const added = await toggleVote(targetType, targetId);
      setVoted(added);
      setDisplayCount((c) => (added ? c + 1 : c - 1));
    } catch {
      // silently fail for votes
    } finally {
      setLoading(false);
    }
  }

  const interactive = Boolean(user && configured);

  return (
    <button
      className={`${styles.upvote} ${voted ? styles.upvoted : ''} ${
        interactive ? '' : styles.disabled
      }`}
      onClick={handleClick}
      disabled={!interactive || loading}
      title={interactive ? (voted ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={voted ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span>{displayCount}</span>
    </button>
  );
}
