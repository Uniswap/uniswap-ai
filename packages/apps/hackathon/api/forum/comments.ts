import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { authenticateRequest } from '../_lib/auth.js';
import { getAdminClient } from '../_lib/supabase.js';

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
  const postId = req.query.postId as string | undefined;
  if (!postId) {
    res.status(400).json({ error: 'postId query parameter is required' });
    return;
  }

  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('forum_comments')
    .select('*, author:profiles(id, name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ comments: data ?? [] });
}

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  let profile;
  try {
    profile = await authenticateRequest(req);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { postId, content, parentId } = req.body ?? {};

  if (typeof postId !== 'string' || !postId) {
    res.status(400).json({ error: 'postId is required' });
    return;
  }

  if (typeof content !== 'string' || content.length < 1 || content.length > 5000) {
    res.status(400).json({ error: 'Content is required and must be 1-5000 characters' });
    return;
  }

  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('forum_comments')
    .insert({
      post_id: postId,
      parent_id: parentId ?? null,
      content,
      author_id: profile.id,
    })
    .select('*, author:profiles(id, name, avatar_url)')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ comment: data });
}
