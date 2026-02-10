import { Link } from 'react-router';
import { NewPostForm } from '../../components/forum/NewPostForm';
import styles from './ForumNewPost.module.css';

export function ForumNewPost() {
  return (
    <div className={styles.container}>
      <Link to="/forum" className={styles.breadcrumb}>
        &larr; Back to Forum
      </Link>
      <h1 className={styles.title}>Create a Post</h1>
      <p className={styles.subtitle}>
        Start a discussion, share your progress, or find teammates for the hackathon.
      </p>
      <NewPostForm />
    </div>
  );
}
