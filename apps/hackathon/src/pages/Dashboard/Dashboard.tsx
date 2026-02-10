import { useLoaderData } from 'react-router';
import { CountdownTimer } from '../../components/common/CountdownTimer';
import { HACKATHON_CONFIG } from '../../lib/config';
import { assertHackathonProjectArray } from '../../lib/typeGuards';
import { ActivityFeed } from './ActivityFeed';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const projects = assertHackathonProjectArray(useLoaderData());

  const uniqueParticipants = new Set(
    projects.flatMap((p) => p.teamMembers.map((m) => m.replace('@', '')))
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Hackathon Dashboard</h1>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCardPink}>
          <span className={styles.metricLabel}>Time Remaining</span>
          <CountdownTimer targetDate={HACKATHON_CONFIG.deadline} />
        </div>

        <div className={styles.metricCardGreen}>
          <span className={styles.metricLabel}>Submissions</span>
          <span className={styles.metricValueGreen}>{projects.length}</span>
        </div>

        <div className={styles.metricCardBlue}>
          <span className={styles.metricLabel}>Participants</span>
          <span className={styles.metricValueBlue}>{uniqueParticipants.size}</span>
        </div>
      </div>

      <section className={styles.feedSection}>
        <h2>Recent Activity</h2>
        <ActivityFeed projects={projects} />
      </section>
    </div>
  );
}
