import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { authenticateRequest } from '../../_lib/auth.js';
import { getAdminClient } from '../../_lib/supabase.js';

const VALID_CATEGORIES = [
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
] as const;

type SortMode = 'hot' | 'new' | 'top';
const VALID_SORTS: SortMode[] = ['hot', 'new', 'top'];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
    } else if (req.method === 'POST') {
      await handlePost(req, res);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const sortParam = req.query.sort as string | undefined;
  const sort: SortMode =
    sortParam && VALID_SORTS.includes(sortParam as SortMode) ? (sortParam as SortMode) : 'hot';
  const category = req.query.category as string | undefined;

  const supabase = getAdminClient();

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
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let posts = data ?? [];

  if (sort === 'hot') {
    posts = [...posts].sort((a, b) => {
      const scoreA = hotScore(a.created_at, a.upvote_count);
      const scoreB = hotScore(b.created_at, b.upvote_count);
      return scoreB - scoreA;
    });
  }

  res.status(200).json({ posts });
}

function hotScore(createdAt: string, upvoteCount: number): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return upvoteCount / Math.pow(ageHours + 2, 1.5);
}

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  let profile;
  try {
    profile = await authenticateRequest(req);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { title, content, category } = req.body ?? {};

  if (typeof title !== 'string' || title.length < 1 || title.length > 200) {
    res.status(400).json({ error: 'Title is required and must be 1-200 characters' });
    return;
  }

  if (typeof content !== 'string' || content.length < 1 || content.length > 10000) {
    res.status(400).json({ error: 'Content is required and must be 1-10000 characters' });
    return;
  }

  if (!category || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    res.status(400).json({
      error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    });
    return;
  }

  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('forum_posts')
    .insert({
      title,
      content,
      category,
      author_id: profile.id,
    })
    .select('*, author:profiles(id, name, avatar_url)')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ post: data });
}
