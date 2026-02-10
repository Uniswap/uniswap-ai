import styles from './Footer.module.css';

const SUBMIT_URL =
  'https://github.com/Uniswap/uniswap-ai/issues/new?template=hackathon-submission.yml';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.cta}>
        <div className={styles.ctaContent}>
          <div className={styles.ctaText}>
            <h2 className={styles.ctaHeading}>Build with the Uniswap AI Hackathon</h2>
            <p className={styles.ctaDescription}>
              Visit the hackathon dashboard to submit your DeFi + AI project and contribute to the
              future of DeFi.
            </p>
          </div>
          <a href={SUBMIT_URL} className={styles.ctaButton}>
            Submit Your Project
          </a>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} Uniswap AI Hackathon
          </span>
          <nav className={styles.bottomNav}>
            <a
              href="https://github.com/Uniswap/uniswap-ai"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              GitHub
            </a>
            <a
              href="https://docs.uniswap.org"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              Docs
            </a>
            <a
              href="https://support.uniswap.org"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              Help
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
