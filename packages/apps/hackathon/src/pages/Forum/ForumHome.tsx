import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { ForumPostCard } from '../../components/forum/ForumPostCard';
import { ForumFilters } from '../../components/forum/ForumFilters';
import { ForumSortBar } from '../../components/forum/ForumSortBar';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../components/auth/AuthProvider';
import { fetchPosts } from '../../lib/forum';
import type { ForumPost, ForumCategory, SortMode } from '../../lib/forum-types';
import styles from './ForumHome.module.css';

export function ForumHome() {
  const { user, configured } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>('hot');
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPosts(sort, category ?? undefined);
      setPosts(data);
    } catch {
      // fall through to empty state
    } finally {
      setLoading(false);
    }
  }, [sort, category]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredPosts = searchQuery
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Forum</h1>
          <p className={styles.subtitle}>Discuss ideas, find teammates, and share progress</p>
        </div>
        {user && configured && (
          <Link to="/forum/new" className={styles.newPostBtn}>
            New Post
          </Link>
        )}
      </div>

      <div className={styles.toolbar}>
        <ForumSortBar active={sort} onChange={setSort} />
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <ForumFilters selected={category} onChange={setCategory} />

      <div className={styles.feed}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="160px" borderRadius="var(--radius-2xl)" />
          ))
        ) : filteredPosts.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {searchQuery || category
                ? 'No posts match your filters.'
                : 'No posts yet. Be the first to start a discussion!'}
            </p>
            {!searchQuery && !category && user && configured && (
              <Link to="/forum/new" className={styles.emptyLink}>
                Create the First Post
              </Link>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => <ForumPostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}
