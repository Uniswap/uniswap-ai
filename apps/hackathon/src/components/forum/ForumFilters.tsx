import { FORUM_CATEGORIES } from '../../lib/forum-types';
import type { ForumCategory } from '../../lib/forum-types';
import styles from './ForumFilters.module.css';

interface ForumFiltersProps {
  selected: ForumCategory | null;
  onChange: (category: ForumCategory | null) => void;
}

export function ForumFilters({ selected, onChange }: ForumFiltersProps) {
  return (
    <div className={styles.filters}>
      <button
        className={`${styles.chip} ${selected === null ? styles.chipActive : ''}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {FORUM_CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={`${styles.chip} ${selected === cat ? styles.chipActive : ''}`}
          onClick={() => onChange(selected === cat ? null : cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
