import { HOW_TO_STEPS } from '../../../lib/config';
import styles from '../Landing.module.css';

export function HowToParticipate() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>How to Participate</h2>
      <div className={styles.stepsGrid}>
        {HOW_TO_STEPS.map((item) => (
          <div key={item.step} className={styles.stepCard}>
            <span className={styles.stepNumber}>{item.step}</span>
            <h3 className={styles.stepTitle}>{item.title}</h3>
            <p className={styles.stepDescription}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
