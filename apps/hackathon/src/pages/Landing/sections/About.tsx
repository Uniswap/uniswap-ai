import styles from '../Landing.module.css';

export function About() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>About the Hackathon</h2>
      <div className={styles.aboutGrid}>
        <div className={styles.aboutCardPink}>
          <div className={styles.aboutIconPink} aria-hidden="true">
            {'🤖'}
          </div>
          <h3>AI + DeFi</h3>
          <p>
            Explore the intersection of artificial intelligence and decentralized finance. Build
            tools that leverage AI to improve the Uniswap ecosystem.
          </p>
        </div>
        <div className={styles.aboutCardBlue}>
          <div className={styles.aboutIconBlue} aria-hidden="true">
            {'🌐'}
          </div>
          <h3>Open Source</h3>
          <p>
            All submissions must be open source. Share your innovations with the community and
            contribute to the growing Uniswap developer ecosystem.
          </p>
        </div>
        <div className={styles.aboutCardGreen}>
          <div className={styles.aboutIconGreen} aria-hidden="true">
            {'👥'}
          </div>
          <h3>For Everyone</h3>
          <p>
            Whether you are a seasoned DeFi developer or just getting started with AI, there is a
            place for you. Solo devs and teams welcome.
          </p>
        </div>
      </div>
    </section>
  );
}
