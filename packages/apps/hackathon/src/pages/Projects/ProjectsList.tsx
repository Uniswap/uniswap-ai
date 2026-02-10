import { Link, useLoaderData } from 'react-router';
import { ProjectCard } from '../../components/common/ProjectCard';
import { assertHackathonProjectArray } from '../../lib/typeGuards';
import styles from './ProjectsList.module.css';

export function ProjectsList() {
  const projects = assertHackathonProjectArray(useLoaderData());

  if (!projects || projects.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Project Submissions</h1>
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No submissions yet. Be the first to submit your project!
          </p>
          <Link to="/" className={styles.emptyLink}>
            Submit Your Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Project Submissions</h1>
      <p className={styles.subtitle}>
        {projects.length} project{projects.length !== 1 ? 's' : ''} submitted
      </p>
      <div className={styles.grid}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            title={project.title}
            description={project.description}
            category={project.category}
            teamMembers={project.teamMembers}
            slug={project.slug}
            createdAt={project.createdAt}
          />
        ))}
      </div>
    </div>
  );
}
