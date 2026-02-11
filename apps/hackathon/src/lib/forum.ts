import { getSupabaseClient } from './supabase';
import type {
  ForumPost,
  ForumComment,
  ForumCategory,
  SortMode,
  CreatePostInput,
  CreateCommentInput,
} from './forum-types';

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

function sortPosts(posts: ForumPost[], mode: SortMode): ForumPost[] {
  const sorted = [...posts];
  switch (mode) {
    case 'new':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'top':
      return sorted.sort((a, b) => b.upvoteCount - a.upvoteCount);
    case 'hot': {
      // Simple "hot" score: upvotes weighted by recency
      const score = (p: ForumPost) => {
        const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / 3_600_000;
        return p.upvoteCount / Math.pow(ageHours + 2, 1.5);
      };
      return sorted.sort((a, b) => score(b) - score(a));
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchPosts(
  sort: SortMode = 'hot',
  category?: ForumCategory
): Promise<ForumPost[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  let query = supabase.from('forum_posts').select('*, author:profiles(id, name, avatar_url)');

  if (category) {
    query = query.eq('category', category);
  }

  switch (sort) {
    case 'new':
      query = query.order('created_at', { ascending: false });
      break;
    case 'top':
      query = query.order('upvote_count', { ascending: false });
      break;
    case 'hot':
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []).map(mapPostRow);
  const votedIds = await getUserVotedIds(
    'post',
    posts.map((p) => p.id)
  );
  for (const post of posts) {
    post.hasUpvoted = votedIds.has(post.id);
  }
  return sort === 'hot' ? sortPosts(posts, 'hot') : posts;
}

export async function fetchPost(postId: string): Promise<ForumPost | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('forum_posts')
    .select('*, author:profiles(id, name, avatar_url)')
    .eq('id', postId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const post = mapPostRow(data);
  const votedIds = await getUserVotedIds('post', [post.id]);
  post.hasUpvoted = votedIds.has(post.id);
  return post;
}

export async function fetchComments(postId: string): Promise<ForumComment[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('forum_comments')
    .select('*, author:profiles(id, name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments = (data ?? []).map(mapCommentRow);
  const votedIds = await getUserVotedIds(
    'comment',
    comments.map((c) => c.id)
  );
  for (const comment of comments) {
    comment.hasUpvoted = votedIds.has(comment.id);
  }
  return buildCommentTree(comments);
}

export async function createPost(input: CreatePostInput): Promise<ForumPost> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('forum_posts')
    .insert({
      title: input.title,
      content: input.content,
      category: input.category,
      author_id: session.session.user.id,
    })
    .select('*, author:profiles(id, name, avatar_url)')
    .single();

  if (error) throw error;
  return mapPostRow(data);
}

export async function createComment(input: CreateCommentInput): Promise<ForumComment> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('forum_comments')
    .insert({
      post_id: input.postId,
      parent_id: input.parentId,
      content: input.content,
      author_id: session.session.user.id,
    })
    .select('*, author:profiles(id, name, avatar_url)')
    .single();

  if (error) throw error;
  return mapCommentRow(data);
}

export async function toggleVote(
  targetType: 'post' | 'comment',
  targetId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const userId = session.session.user.id;

  // Check if vote exists
  const { data: existing } = await supabase
    .from('forum_votes')
    .select('id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();

  if (existing) {
    await supabase.from('forum_votes').delete().eq('id', existing.id);
    return false; // removed
  }

  await supabase.from('forum_votes').insert({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
  });
  return true; // added
}

// ---------------------------------------------------------------------------
// Vote hydration
// ---------------------------------------------------------------------------

async function getUserVotedIds(
  targetType: 'post' | 'comment',
  targetIds: string[]
): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  if (!supabase || targetIds.length === 0) return new Set();

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return new Set();

  const { data } = await supabase
    .from('forum_votes')
    .select('target_id')
    .eq('user_id', session.session.user.id)
    .eq('target_type', targetType)
    .in('target_id', targetIds);

  return new Set((data ?? []).map((row: { target_id: string }) => row.target_id));
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

interface PostRow {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  upvote_count: number;
  comment_count: number;
  has_upvoted?: boolean;
  author: { id: string; name: string; avatar_url: string } | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  upvote_count: number;
  has_upvoted?: boolean;
  author: { id: string; name: string; avatar_url: string } | null;
}

function mapPostRow(row: PostRow): ForumPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category as ForumPost['category'],
    author: {
      id: row.author?.id ?? 'unknown',
      name: row.author?.name ?? 'Unknown',
      avatarUrl: row.author?.avatar_url ?? '',
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    upvoteCount: row.upvote_count ?? 0,
    commentCount: row.comment_count ?? 0,
    hasUpvoted: row.has_upvoted ?? false,
  };
}

function mapCommentRow(row: CommentRow): ForumComment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    content: row.content,
    author: {
      id: row.author?.id ?? 'unknown',
      name: row.author?.name ?? 'Unknown',
      avatarUrl: row.author?.avatar_url ?? '',
    },
    createdAt: row.created_at,
    upvoteCount: row.upvote_count ?? 0,
    hasUpvoted: row.has_upvoted ?? false,
    replies: [],
  };
}

function buildCommentTree(flat: ForumComment[]): ForumComment[] {
  const map = new Map<string, ForumComment>();
  const roots: ForumComment[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId) {
      const parent = map.get(c.parentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}
