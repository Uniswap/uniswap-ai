import { Link } from 'react-router';
import { CountdownTimer } from '../../../components/common/CountdownTimer';
import { HACKATHON_CONFIG } from '../../../lib/config';
import styles from '../Landing.module.css';

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>
          Uniswap <span className={styles.heroTitleAccent}>AI</span> Hackathon
        </h1>
        <p className={styles.heroTagline}>{HACKATHON_CONFIG.tagline}</p>
        <p className={styles.heroDescription}>{HACKATHON_CONFIG.description}</p>
        <CountdownTimer targetDate={HACKATHON_CONFIG.deadline} />
        <div className={styles.heroCtas}>
          <a
            href={`https://github.com/${HACKATHON_CONFIG.github.owner}/${HACKATHON_CONFIG.github.repo}/issues/new?template=hackathon-submission.yml`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primaryButton}
          >
            Submit Your Project
          </a>
          <Link to="/projects" className={styles.secondaryButton}>
            View Submissions
          </Link>
        </div>
      </div>
    </section>
  );
}
