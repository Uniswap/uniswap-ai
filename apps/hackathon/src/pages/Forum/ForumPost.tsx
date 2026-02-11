import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer';
import { Tag } from '../../components/common/Tag';
import { Skeleton } from '../../components/common/Skeleton';
import { UpvoteButton } from '../../components/forum/UpvoteButton';
import { CommentThread } from '../../components/forum/CommentThread';
import { CommentForm } from '../../components/forum/CommentForm';
import { fetchPost, fetchComments } from '../../lib/forum';
import { timeAgo, formatDate } from '../../lib/formatters';
import type { ForumPost as ForumPostType, ForumComment } from '../../lib/forum-types';
import styles from './ForumPost.module.css';

export function ForumPost() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<ForumPostType | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadData = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [postData, commentData] = await Promise.all([fetchPost(postId), fetchComments(postId)]);
      if (!postData) {
        setNotFound(true);
        return;
      }
      setPost(postData);
      setComments(commentData);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonGroup}>
          <Skeleton height="32px" width="200px" borderRadius="var(--radius-lg)" />
          <Skeleton height="48px" borderRadius="var(--radius-lg)" />
          <Skeleton height="200px" borderRadius="var(--radius-2xl)" />
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className={`${styles.container} ${styles.fadeIn}`}>
        <div className={styles.notFound}>
          <h2>Post not found</h2>
          <p>This post may have been removed or the link is incorrect.</p>
          <Link to="/forum" className={styles.backLink}>
            Back to Forum
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles.fadeIn}`}>
      <Link to="/forum" className={styles.breadcrumb}>
        &larr; Back to Forum
      </Link>

      <article className={styles.post}>
        <div className={styles.postHeader}>
          <h1 className={styles.postTitle}>{post.title}</h1>
          <div className={styles.postMeta}>
            <img src={post.author.avatarUrl} alt="" className={styles.avatar} />
            <span className={styles.authorName}>{post.author.name}</span>
            <span className={styles.dot}>&middot;</span>
            <time className={styles.time} title={formatDate(post.createdAt)}>
              {timeAgo(post.createdAt)}
            </time>
            <Tag label={post.category} />
          </div>
        </div>

        <div className={styles.postBody}>
          <MarkdownRenderer content={post.content} />
        </div>

        <div className={styles.postActions}>
          <UpvoteButton
            targetType="post"
            targetId={post.id}
            count={post.upvoteCount}
            hasUpvoted={post.hasUpvoted}
          />
          <span className={styles.commentCount}>
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </article>

      <section className={styles.commentsSection}>
        <h2 className={styles.commentsTitle}>Comments</h2>
        <CommentForm postId={post.id} parentId={null} onSubmit={loadData} />
        <CommentThread comments={comments} postId={post.id} onCommentAdded={loadData} />
      </section>
    </div>
  );
}
