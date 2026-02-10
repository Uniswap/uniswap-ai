import { useState, useMemo } from 'react';
import { Link, useLoaderData } from 'react-router';
import { ProjectCard } from '../../components/common/ProjectCard';
import { ProjectSortBar } from '../../components/common/ProjectSortBar';
import { assertProjectWithVotesArray } from '../../lib/typeGuards';
import type { ProjectSortMode, ProjectWithVotes } from '../../lib/types';
import styles from './ProjectsList.module.css';

function sortProjects(projects: ProjectWithVotes[], mode: ProjectSortMode): ProjectWithVotes[] {
  const sorted = [...projects];
  switch (mode) {
    case 'votes':
      return sorted.sort((a, b) => {
        if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    case 'newest':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'oldest':
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }
}

export function ProjectsList() {
  const projects = assertProjectWithVotesArray(useLoaderData());
  const [sortMode, setSortMode] = useState<ProjectSortMode>('votes');

  const sorted = useMemo(() => sortProjects(projects, sortMode), [projects, sortMode]);

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
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Project Submissions</h1>
          <p className={styles.subtitle}>
            {projects.length} project{projects.length !== 1 ? 's' : ''} submitted
          </p>
        </div>
        <ProjectSortBar active={sortMode} onChange={setSortMode} />
      </div>
      <div className={styles.grid}>
        {sorted.map((project) => (
          <ProjectCard
            key={project.id}
            title={project.title}
            description={project.description}
            category={project.category}
            teamMembers={project.teamMembers}
            slug={project.slug}
            createdAt={project.createdAt}
            issueNumber={project.issueNumber}
            upvoteCount={project.upvoteCount}
            hasUpvoted={project.hasUpvoted}
          />
        ))}
      </div>
    </div>
  );
}
