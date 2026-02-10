import { useState } from 'react';
import { FAQ_ITEMS } from '../../../lib/config';
import styles from '../Landing.module.css';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
      <div className={styles.faqList}>
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          const questionId = `faq-question-${index}`;
          const answerId = `faq-answer-${index}`;

          return (
            <div key={index} className={styles.faqItem}>
              <button
                id={questionId}
                className={styles.faqQuestion}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-controls={answerId}
              >
                <span>{item.question}</span>
                <span className={`${styles.faqIcon}${isOpen ? ` ${styles.faqIconOpen}` : ''}`}>
                  +
                </span>
              </button>
              {isOpen && (
                <div
                  id={answerId}
                  role="region"
                  aria-labelledby={questionId}
                  className={styles.faqAnswer}
                >
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
