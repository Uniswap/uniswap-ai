import { Outlet, useLocation } from 'react-router';
import { Agentation } from 'agentation';
import { Header } from './Header';
import { Footer } from './Footer';
import { ChatWidget } from '../chat/ChatWidget';
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
      <ChatWidget />
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}
