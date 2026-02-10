import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { GitHubRateLimitError } from '../../lib/github';
import styles from './ErrorBoundary.module.css';

export function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof GitHubRateLimitError) {
    return (
      <div className={styles.container} role="alert">
        <div className={styles.card}>
          <div className={styles.icon} aria-hidden="true">
            &#x23F3;
          </div>
          <h1 className={styles.title}>Rate limit reached</h1>
          <p className={styles.message}>
            The GitHub API rate limit has been exceeded. This typically happens with unauthenticated
            requests (60 per hour).
          </p>
          <p className={styles.rateLimitMessage}>Resets at {error.resetAt.toLocaleTimeString()}</p>
          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              onClick={() => window.location.reload()}
              type="button"
            >
              Try again
            </button>
            <Link className={styles.secondaryButton} to="/">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className={styles.container} role="alert">
        <div className={styles.card}>
          <div className={styles.icon} aria-hidden="true">
            &#x1F50D;
          </div>
          <h1 className={styles.title}>Page not found</h1>
          <p className={styles.message}>
            The page you are looking for does not exist or the project may have been removed.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} to="/projects">
              View all projects
            </Link>
            <Link className={styles.secondaryButton} to="/">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} role="alert">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          &#x26A0;
        </div>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>
          An unexpected error occurred while loading this page. Please try again.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload page
          </button>
          <Link className={styles.secondaryButton} to="/">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
