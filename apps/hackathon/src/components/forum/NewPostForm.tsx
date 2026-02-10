import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FORUM_CATEGORIES } from '../../lib/forum-types';
import type { ForumCategory } from '../../lib/forum-types';
import { useAuth } from '../auth/AuthProvider';
import { createPost } from '../../lib/forum';
import styles from './NewPostForm.module.css';

export function NewPostForm() {
  const navigate = useNavigate();
  const { user, configured, signInWithGitHub } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ForumCategory>('General');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className={styles.notConfigured}>
        <p>Forum backend is not configured yet. Posts cannot be created in demo mode.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.signIn}>
        <h2 className={styles.signInTitle}>Sign in to create a post</h2>
        <p className={styles.signInText}>
          Connect your GitHub account to start a discussion with the community.
        </p>
        <button onClick={signInWithGitHub} className={styles.signInBtn}>
          Sign in with GitHub
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const post = await createPost({
        title: title.trim(),
        content: content.trim(),
        category,
      });
      navigate(`/forum/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="post-title" className={styles.label}>
          Title
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          className={styles.input}
          maxLength={200}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="post-category" className={styles.label}>
          Category
        </label>
        <select
          id="post-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ForumCategory)}
          className={styles.select}
        >
          {FORUM_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="post-content" className={styles.label}>
          Content
        </label>
        <textarea
          id="post-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share details, ask questions, or start a discussion..."
          className={styles.textarea}
          rows={8}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={() => navigate('/forum')}>
          Cancel
        </button>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!title.trim() || !content.trim() || submitting}
        >
          {submitting ? 'Creating...' : 'Create Post'}
        </button>
      </div>
    </form>
  );
}
