import styles from '../Landing.module.css';

function SparkleIcon() {
  return (
    <svg viewBox="0 0 17 16" fill="none" width="24" height="24" aria-hidden="true">
      <path
        d="M14.5913 7.67945L12.7733 7.1601C11.1013 6.6821 9.81729 5.39876 9.33929 3.7261L8.81997 1.9081C8.73797 1.6221 8.26063 1.6221 8.17863 1.9081L7.6593 3.7261C7.1813 5.39876 5.8973 6.68276 4.2253 7.1601L2.40729 7.67945C2.26395 7.72011 2.16528 7.85144 2.16528 8.0001C2.16528 8.14877 2.26395 8.27943 2.40729 8.32076L4.2253 8.84011C5.8973 9.31811 7.1813 10.6014 7.6593 12.2741L8.17863 14.0921C8.21996 14.2354 8.35062 14.3341 8.49929 14.3341C8.64795 14.3341 8.77863 14.2354 8.81997 14.0921L9.33929 12.2741C9.81729 10.6014 11.1013 9.31744 12.7733 8.84011L14.5913 8.32076C14.7346 8.2801 14.8333 8.14877 14.8333 8.0001C14.8333 7.85144 14.7346 7.72078 14.5913 7.67945Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
      <path
        d="M9.72571 3.28983C6.16881 4.21597 3.46801 7.26324 3.05493 11H7.05009C7.2743 8.23681 8.1991 5.58442 9.72571 3.28983ZM14.2743 3.28983C15.8009 5.58442 16.7257 8.23681 16.9499 11H20.9451C20.532 7.26324 17.8312 4.21597 14.2743 3.28983ZM14.9424 11C14.6912 8.28683 13.6697 5.70193 12 3.5508C10.3303 5.70193 9.30879 8.28683 9.05759 11H14.9424ZM9.05759 13H14.9424C14.6912 15.7132 13.6697 18.2981 12 20.4492C10.3303 18.2981 9.30879 15.7132 9.05759 13ZM7.05009 13H3.05493C3.46801 16.7368 6.16881 19.784 9.72571 20.7102C8.1991 18.4156 7.2743 15.7632 7.05009 13ZM14.2743 20.7102C15.8009 18.4156 16.7257 15.7632 16.9499 13H20.9451C20.532 16.7368 17.8312 19.784 14.2743 20.7102ZM12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
      <path
        d="M8.00903 6.5C8.00903 4.294 9.80303 2.5 12.009 2.5C14.215 2.5 16.009 4.294 16.009 6.5C16.009 8.706 14.215 10.5 12.009 10.5C9.80303 10.5 8.00903 8.706 8.00903 6.5ZM14 12.5H10C5.94 12.5 4.5 15.473 4.5 18.019C4.5 20.296 5.71105 21.5 8.00305 21.5H15.9969C18.2889 21.5 19.5 20.296 19.5 18.019C19.5 15.473 18.06 12.5 14 12.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function About() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>About the Hackathon</h2>
      <div className={styles.aboutGrid}>
        <div className={styles.aboutCardPink}>
          <div className={styles.aboutIconPink}>
            <SparkleIcon />
          </div>
          <h3>AI + DeFi</h3>
          <p>
            Explore the intersection of artificial intelligence and decentralized finance. Build
            tools that leverage AI to improve the Uniswap ecosystem.
          </p>
        </div>
        <div className={styles.aboutCardBlue}>
          <div className={styles.aboutIconBlue}>
            <GlobeIcon />
          </div>
          <h3>Open Source</h3>
          <p>
            All submissions must be open source. Share your innovations with the community and
            contribute to the growing Uniswap developer ecosystem.
          </p>
        </div>
        <div className={styles.aboutCardGreen}>
          <div className={styles.aboutIconGreen}>
            <PersonIcon />
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
