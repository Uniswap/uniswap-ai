import { Outlet, useLocation } from 'react-router';
import { Header } from './Header';
import { Footer } from './Footer';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <div key={location.pathname} className={styles.pageTransition}>
          <Outlet />
        </div>
      </main>
      <Footer />
      {import.meta.env.DEV && (
        <a
          href="https://agentation.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.fab}
          title="Agentation – visual feedback for AI agents"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
          Agentation
        </a>
      )}
    </div>
  );
}
