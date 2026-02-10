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
    </div>
  );
}
