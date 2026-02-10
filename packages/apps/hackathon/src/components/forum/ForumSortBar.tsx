import type { SortMode } from '../../lib/forum-types';
import styles from './ForumSortBar.module.css';

interface ForumSortBarProps {
  active: SortMode;
  onChange: (mode: SortMode) => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
];

export function ForumSortBar({ active, onChange }: ForumSortBarProps) {
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
