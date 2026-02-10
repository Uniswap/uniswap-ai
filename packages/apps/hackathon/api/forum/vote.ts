import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { authenticateRequest } from '../_lib/auth.js';
import { getAdminClient } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  try {
    await handleVote(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}

async function handleVote(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let profile;
  try {
    profile = await authenticateRequest(req);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { targetType, targetId } = req.body ?? {};

  if (targetType !== 'post' && targetType !== 'comment') {
    res.status(400).json({ error: 'targetType must be "post" or "comment"' });
    return;
  }

  if (typeof targetId !== 'string' || !targetId) {
    res.status(400).json({ error: 'targetId is required' });
    return;
  }

  const supabase = getAdminClient();

  const { data: existing } = await supabase
    .from('forum_votes')
    .select('id')
    .eq('user_id', profile.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('forum_votes').delete().eq('id', existing.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ voted: false });
  } else {
    const { error } = await supabase.from('forum_votes').insert({
      user_id: profile.id,
      target_type: targetType,
      target_id: targetId,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ voted: true });
  }
}
