import { useState } from 'react';
import { FAQ_ITEMS } from '../../../lib/config';
import styles from '../Landing.module.css';

export function FAQ() {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
      <div className={styles.faqList}>
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndices.has(index);
          const questionId = `faq-question-${index}`;
          const answerId = `faq-answer-${index}`;

          return (
            <div key={index} className={styles.faqItem}>
              <button
                id={questionId}
                className={styles.faqQuestion}
                onClick={() =>
                  setOpenIndices((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
                aria-expanded={isOpen}
                aria-controls={answerId}
              >
                <span>{item.question}</span>
                <span className={`${styles.faqIcon}${isOpen ? ` ${styles.faqIconOpen}` : ''}`}>
                  +
                </span>
              </button>
              <div
                id={answerId}
                role="region"
                aria-labelledby={questionId}
                className={`${styles.faqAnswerWrapper}${isOpen ? ` ${styles.faqAnswerOpen}` : ''}`}
              >
                <div className={styles.faqAnswer}>
                  <p>{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
