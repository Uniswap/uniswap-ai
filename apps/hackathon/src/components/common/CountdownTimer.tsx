import { useState, useEffect, useMemo } from 'react';
import styles from './CountdownTimer.module.css';

interface CountdownTimerProps {
  targetDate: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const target = useMemo(() => new Date(targetDate), [targetDate]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => computeTimeLeft(target));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = computeTimeLeft(target);
      setTimeLeft(remaining);
      if (!remaining) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return <div className={styles.ended}>Hackathon Ended</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <span className={styles.value}>{timeLeft.days}</span>
        <span className={styles.label}>Days</span>
      </div>
      <div className={styles.card}>
        <span className={styles.value}>{timeLeft.hours}</span>
        <span className={styles.label}>Hours</span>
      </div>
      <div className={styles.card}>
        <span className={styles.value}>{timeLeft.minutes}</span>
        <span className={styles.label}>Minutes</span>
      </div>
      <div className={styles.card}>
        <span className={styles.value}>{timeLeft.seconds}</span>
        <span className={styles.label}>Seconds</span>
      </div>
    </div>
  );
}
