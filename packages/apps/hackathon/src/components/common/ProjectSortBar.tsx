import type { ProjectSortMode } from '../../lib/types';
import styles from '../forum/ForumSortBar.module.css';

interface ProjectSortBarProps {
  active: ProjectSortMode;
  onChange: (mode: ProjectSortMode) => void;
}

const SORT_OPTIONS: { value: ProjectSortMode; label: string }[] = [
  { value: 'votes', label: 'Most Votes' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export function ProjectSortBar({ active, onChange }: ProjectSortBarProps) {
  return (
    <div className={styles.bar}>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.tab} ${active === opt.value ? styles.tabActive : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
