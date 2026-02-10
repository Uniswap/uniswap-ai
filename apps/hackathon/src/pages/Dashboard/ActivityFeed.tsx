import { Link } from 'react-router';
import { Tag } from '../../components/common/Tag';
import { timeAgo } from '../../lib/formatters';
import type { HackathonProject } from '../../lib/types';
import styles from './Dashboard.module.css';

interface ActivityFeedProps {
  projects: HackathonProject[];
}

export function ActivityFeed({ projects }: ActivityFeedProps) {
  if (projects.length === 0) {
    return (
      <div className={styles.emptyFeed}>
        <p>No activity yet. Submissions will appear here.</p>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      {projects.slice(0, 20).map((project) => (
        <Link key={project.id} to={`/projects/${project.slug}`} className={styles.feedItem}>
          <div className={styles.feedItemHeader}>
            <img
              src={project.authorAvatarUrl}
              alt={project.authorLogin}
              className={styles.feedAvatar}
            />
            <div className={styles.feedItemInfo}>
              <span className={styles.feedItemAuthor}>{project.authorLogin}</span>
              <span className={styles.feedItemTime}>{timeAgo(project.createdAt)}</span>
            </div>
          </div>
          <div className={styles.feedItemBody}>
            <span className={styles.feedItemTitle}>{project.title}</span>
            <Tag label={project.category} />
          </div>
        </Link>
      ))}
    </div>
  );
}
