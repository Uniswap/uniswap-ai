import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-md)',
}: SkeletonProps) {
  return <div className={styles.skeleton} style={{ width, height, borderRadius }} />;
}
