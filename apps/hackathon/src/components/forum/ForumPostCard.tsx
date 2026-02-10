import { Link } from 'react-router';
import { truncate, timeAgo } from '../../lib/formatters';
import { Tag } from '../common/Tag';
import { UpvoteButton } from './UpvoteButton';
import type { ForumPost } from '../../lib/forum-types';
import styles from './ForumPostCard.module.css';

interface ForumPostCardProps {
  post: ForumPost;
}

export function ForumPostCard({ post }: ForumPostCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.voteCol}>
        <UpvoteButton
          targetType="post"
          targetId={post.id}
          count={post.upvoteCount}
          hasUpvoted={post.hasUpvoted}
        />
      </div>
      <div className={styles.content}>
        <Link to={`/forum/${post.id}`} className={styles.titleLink}>
          <h3 className={styles.title}>{post.title}</h3>
        </Link>
        <p className={styles.body}>{truncate(post.content, 200)}</p>
        <div className={styles.meta}>
          <div className={styles.metaLeft}>
            <img src={post.author.avatarUrl} alt="" className={styles.avatar} />
            <span className={styles.author}>{post.author.name}</span>
            <span className={styles.dot}>&middot;</span>
            <span className={styles.time}>{timeAgo(post.createdAt)}</span>
          </div>
          <div className={styles.metaRight}>
            <Tag label={post.category} />
            <Link to={`/forum/${post.id}`} className={styles.commentLink}>
              {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
