import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { getAdminClient } from './supabase.js';

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar_url: string;
}

export async function verifyGitHubToken(
  token: string
): Promise<{ id: string; login: string; avatar_url: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Invalid GitHub token');
  }

  const user: GitHubUser = await res.json();
  return {
    id: String(user.id),
    login: user.login,
    avatar_url: user.avatar_url,
  };
}

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  githubUser: { id: string; login: string; avatar_url: string }
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: githubUser.id,
        name: githubUser.login,
        avatar_url: githubUser.avatar_url,
      },
      { onConflict: 'id' }
    )
    .select('id, name, avatar_url')
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function authenticateRequest(req: VercelRequest): Promise<Profile> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  const githubUser = await verifyGitHubToken(token);
  const supabase = getAdminClient();
  return getOrCreateProfile(supabase, githubUser);
}
