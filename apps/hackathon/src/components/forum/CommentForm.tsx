import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createComment } from '../../lib/forum';
import styles from './CommentForm.module.css';

interface CommentFormProps {
  postId: string;
  parentId: string | null;
  onSubmit: () => void;
  compact?: boolean;
}

export function CommentForm({ postId, parentId, onSubmit, compact }: CommentFormProps) {
  const { user, configured, signInWithGitHub } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return null;
  }

  if (!user) {
    return (
      <div className={styles.signInPrompt}>
        <button onClick={signInWithGitHub} className={styles.signInBtn}>
          Sign in with GitHub
        </button>
        <span className={styles.signInText}>to join the discussion</span>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await createComment({ postId, parentId, content: content.trim() });
      setContent('');
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} ${compact ? styles.compact : ''}`}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? 'Write a reply...' : 'Share your thoughts...'}
        className={styles.textarea}
        rows={compact ? 2 : 3}
      />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.submitBtn} disabled={!content.trim() || submitting}>
          {submitting ? 'Posting...' : parentId ? 'Reply' : 'Comment'}
        </button>
      </div>
    </form>
  );
}
