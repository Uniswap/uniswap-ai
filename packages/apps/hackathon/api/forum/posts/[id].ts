import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { getAdminClient } from '../../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { id } = req.query;
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Missing post ID' });
      return;
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('forum_posts')
      .select('*, author:profiles(id, name, avatar_url)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ post: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}
