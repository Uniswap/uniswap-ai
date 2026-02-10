import { Link, useLoaderData } from 'react-router';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer';
import { Tag } from '../../components/common/Tag';
import { formatDate } from '../../lib/formatters';
import { assertHackathonProject } from '../../lib/typeGuards';
import styles from './ProjectDetail.module.css';

export function ProjectDetail() {
  const project = assertHackathonProject(useLoaderData());

  return (
    <div className={styles.container}>
      <Link to="/projects" className={styles.backLink}>
        &larr; Back to Projects
      </Link>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{project.title}</h1>
          <Tag label={project.category} variant="accent" />
        </div>

        <div className={styles.meta}>
          <div className={styles.author}>
            <img
              src={project.authorAvatarUrl}
              alt={project.authorLogin}
              className={styles.avatar}
            />
            <span>{project.authorLogin}</span>
          </div>
          <span className={styles.date}>Submitted {formatDate(project.createdAt)}</span>
        </div>
      </header>

      <div className={styles.links}>
        <a
          href={project.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.linkButton}
        >
          GitHub Repository
        </a>
        {project.demoUrl && (
          <a
            href={project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkButton}
          >
            Live Demo
          </a>
        )}
        <a
          href={project.issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.linkButtonSecondary}
        >
          View on GitHub
        </a>
      </div>

      <section className={styles.section}>
        <h2>Description</h2>
        <MarkdownRenderer content={project.description} />
      </section>

      {project.techStack.length > 0 && (
        <section className={styles.section}>
          <h2>Tech Stack</h2>
          <div className={styles.tags}>
            {project.techStack.map((tech) => (
              <Tag key={tech} label={tech} />
            ))}
          </div>
        </section>
      )}

      {project.teamMembers.length > 0 && (
        <section className={styles.section}>
          <h2>Team</h2>
          <div className={styles.team}>
            {project.teamMembers.map((member) => (
              <a
                key={member}
                href={`https://github.com/${member.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.teamMember}
              >
                {member}
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>Last updated: {formatDate(project.updatedAt)}</span>
        <span>Issue #{project.issueNumber}</span>
      </footer>
    </div>
  );
}
