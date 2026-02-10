import { useState } from 'react';
import { timeAgo } from '../../lib/formatters';
import { UpvoteButton } from './UpvoteButton';
import { CommentForm } from './CommentForm';
import { useAuth } from '../auth/AuthProvider';
import type { ForumComment } from '../../lib/forum-types';
import styles from './CommentThread.module.css';

interface CommentThreadProps {
  comments: ForumComment[];
  postId: string;
  onCommentAdded: () => void;
}

export function CommentThread({ comments, postId, onCommentAdded }: CommentThreadProps) {
  if (comments.length === 0) {
    return <p className={styles.empty}>No comments yet. Be the first to share your thoughts!</p>;
  }

  return (
    <div className={styles.thread}>
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          postId={postId}
          depth={0}
          onCommentAdded={onCommentAdded}
        />
      ))}
    </div>
  );
}

interface CommentNodeProps {
  comment: ForumComment;
  postId: string;
  depth: number;
  onCommentAdded: () => void;
}

function CommentNode({ comment, postId, depth, onCommentAdded }: CommentNodeProps) {
  const { user } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const maxDepth = 4;

  return (
    <div className={styles.node} style={{ marginLeft: depth > 0 ? 'var(--space-6)' : '0' }}>
      <div className={styles.comment}>
        <div className={styles.commentHeader}>
          <img src={comment.author.avatarUrl} alt="" className={styles.avatar} />
          <span className={styles.authorName}>{comment.author.name}</span>
          <span className={styles.dot}>&middot;</span>
          <span className={styles.time}>{timeAgo(comment.createdAt)}</span>
        </div>
        <p className={styles.commentBody}>{comment.content}</p>
        <div className={styles.commentActions}>
          <UpvoteButton
            targetType="comment"
            targetId={comment.id}
            count={comment.upvoteCount}
            hasUpvoted={comment.hasUpvoted}
          />
          {user && depth < maxDepth && (
            <button className={styles.replyBtn} onClick={() => setShowReply(!showReply)}>
              {showReply ? 'Cancel' : 'Reply'}
            </button>
          )}
        </div>
        {showReply && (
          <div className={styles.replyForm}>
            <CommentForm
              postId={postId}
              parentId={comment.id}
              onSubmit={() => {
                setShowReply(false);
                onCommentAdded();
              }}
              compact
            />
          </div>
        )}
      </div>
      {comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              onCommentAdded={onCommentAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
