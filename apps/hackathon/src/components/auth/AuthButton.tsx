import { useAuth } from './AuthProvider';
import styles from './AuthButton.module.css';

export function AuthButton() {
  const { user, loading, configured, signInWithGitHub, signOut } = useAuth();

  if (!configured || loading) {
    return null;
  }

  if (user) {
    return (
      <div className={styles.wrapper}>
        <img
          src={user.user_metadata?.avatar_url ?? ''}
          alt={user.user_metadata?.user_name ?? 'User'}
          className={styles.avatar}
        />
        <button onClick={signOut} className={styles.button}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button onClick={signInWithGitHub} className={styles.button}>
      Sign In
    </button>
  );
}
