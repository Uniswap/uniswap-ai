import { createBrowserRouter } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Landing } from './pages/Landing/Landing';
import { ProjectsList } from './pages/Projects/ProjectsList';
import { ProjectDetail } from './pages/ProjectDetail/ProjectDetail';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ForumHome } from './pages/Forum/ForumHome';
import { ForumPost } from './pages/Forum/ForumPost';
import { ForumNewPost } from './pages/Forum/ForumNewPost';
import { fetchSubmissions } from './lib/github';
import { parseSubmission } from './lib/parseSubmission';
import type { HackathonProject } from './lib/types';

let cachedProjects: HackathonProject[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

let inflightFetch: Promise<HackathonProject[]> | null = null;

function invalidateCache() {
  cachedProjects = null;
  cacheTimestamp = 0;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    invalidateCache();
  }
});

async function loadProjects(): Promise<HackathonProject[]> {
  const now = Date.now();
  if (cachedProjects && now - cacheTimestamp < CACHE_TTL) {
    return cachedProjects;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = fetchSubmissions()
    .then((issues) => {
      cachedProjects = issues.map(parseSubmission);
      cacheTimestamp = Date.now();
      return cachedProjects;
    })
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

async function projectsLoader() {
  return loadProjects();
}

async function projectDetailLoader({ params }: LoaderFunctionArgs) {
  const projects = await loadProjects();
  const project = projects.find((p) => p.slug === params.slug);

  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  return project;
}

async function dashboardLoader() {
  return loadProjects();
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Landing />,
      },
      {
        path: 'projects',
        element: <ProjectsList />,
        loader: projectsLoader,
      },
      {
        path: 'projects/:slug',
        element: <ProjectDetail />,
        loader: projectDetailLoader,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
        loader: dashboardLoader,
      },
      {
        path: 'forum',
        element: <ForumHome />,
      },
      {
        path: 'forum/new',
        element: <ForumNewPost />,
      },
      {
        path: 'forum/:postId',
        element: <ForumPost />,
      },
    ],
  },
]);
