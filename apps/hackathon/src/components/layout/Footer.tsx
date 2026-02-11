import styles from './Footer.module.css';

const SUBMIT_URL =
  'https://github.com/Uniswap/uniswap-ai/issues/new?template=hackathon-submission.yml';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.cta}>
        <div className={styles.ctaContent}>
          <div className={styles.ctaText}>
            <h2 className={styles.ctaHeading}>Ship it.</h2>
            <p className={styles.ctaDescription}>
              Enter your project, and shape DeFi&apos;s next era.
            </p>
          </div>
          <a href={SUBMIT_URL} className={styles.ctaButton}>
            Submit Your Project
          </a>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span className={styles.copyright}>&copy; 2026 &ndash; Uniswap Labs</span>
          <nav className={styles.bottomNav}>
            <a
              href="https://x.com/Uniswap"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              X
            </a>
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
            <a
              href="https://uniswap.org/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              Terms &amp; Conditions
            </a>
            <a
              href="https://uniswap.org/trademark"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              Trademark Policy
            </a>
            <a
              href="https://uniswap.org/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bottomLink}
            >
              Privacy Policy
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
