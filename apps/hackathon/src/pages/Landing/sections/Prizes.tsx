import { PRIZES } from '../../../lib/config';
import styles from '../Landing.module.css';

export function Prizes() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Prizes</h2>
      <div className={styles.prizesGrid}>
        {PRIZES.map((prize) => (
          <div key={prize.place} className={styles.prizeCard}>
            <span className={styles.prizePlace}>{prize.place}</span>
            <span className={styles.prizeAmount}>{prize.amount}</span>
          </div>
        ))}
      </div>
      <p className={styles.prizesNote}>Prizes provided by the Uniswap Foundation.</p>
    </section>
  );
}
