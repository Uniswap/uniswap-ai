export interface HackathonProject {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  teamMembers: string[];
  repoUrl: string;
  demoUrl: string | null;
  techStack: string[];
  createdAt: string;
  updatedAt: string;
  authorLogin: string;
  authorAvatarUrl: string;
  issueNumber: number;
  issueUrl: string;
  bodyRaw: string;
}

export interface ProjectWithVotes extends HackathonProject {
  upvoteCount: number;
  hasUpvoted: boolean;
}

export type ProjectSortMode = 'votes' | 'newest' | 'oldest';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  labels: Array<{
    name?: string;
  }>;
}
