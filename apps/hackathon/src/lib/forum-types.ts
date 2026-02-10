export type ForumCategory =
  | 'General'
  | 'Team Formation'
  | 'Ideation'
  | 'Progress Update'
  | 'Product Feedback'
  | 'Trading Agents'
  | 'DeFi Automation'
  | 'Analytics & Monitoring'
  | 'Developer Tooling'
  | 'Infrastructure';

export const FORUM_CATEGORIES: ForumCategory[] = [
  'General',
  'Team Formation',
  'Ideation',
  'Progress Update',
  'Product Feedback',
  'Trading Agents',
  'DeFi Automation',
  'Analytics & Monitoring',
  'Developer Tooling',
  'Infrastructure',
];

export type SortMode = 'hot' | 'new' | 'top';

export interface ForumAuthor {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: ForumCategory;
  author: ForumAuthor;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
  commentCount: number;
  hasUpvoted: boolean;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  author: ForumAuthor;
  createdAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  replies: ForumComment[];
}

export interface CreatePostInput {
  title: string;
  content: string;
  category: ForumCategory;
}

export interface CreateCommentInput {
  postId: string;
  parentId: string | null;
  content: string;
}
