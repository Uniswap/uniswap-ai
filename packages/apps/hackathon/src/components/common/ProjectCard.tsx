import { Link } from 'react-router';
import { truncate, timeAgo } from '../../lib/formatters';
import { Tag } from './Tag';
import { ProjectUpvoteButton } from './ProjectUpvoteButton';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  title: string;
  description: string;
  category: string;
  teamMembers: string[];
  slug: string;
  createdAt: string;
  issueNumber: number;
  upvoteCount: number;
  hasUpvoted: boolean;
}

export function ProjectCard({
  title,
  description,
  category,
  teamMembers,
  slug,
  createdAt,
  issueNumber,
  upvoteCount,
  hasUpvoted,
}: ProjectCardProps) {
  return (
    <Link to={`/projects/${slug}`} className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{truncate(description, 150)}</p>
      <div className={styles.meta}>
        <div className={styles.metaLeft}>
          <Tag label={category} />
          <ProjectUpvoteButton
            issueNumber={issueNumber}
            count={upvoteCount}
            hasUpvoted={hasUpvoted}
          />
        </div>
        <div className={styles.metaRight}>
          <span>
            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
          </span>
          <span>{timeAgo(createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
