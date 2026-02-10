import { getSupabaseClient } from './supabase';

/**
 * Toggle the current user's vote on a project.
 * Returns `true` if vote was added, `false` if removed.
 */
export async function toggleProjectVote(issueNumber: number): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const userId = session.session.user.id;

  const { data: existing } = await supabase
    .from('project_votes')
    .select('id')
    .eq('user_id', userId)
    .eq('issue_number', issueNumber)
    .maybeSingle();

  if (existing) {
    await supabase.from('project_votes').delete().eq('id', existing.id);
    return false;
  }

  await supabase.from('project_votes').insert({
    user_id: userId,
    issue_number: issueNumber,
  });
  return true;
}

/**
 * Fetch vote counts for a list of projects (by issue number).
 * Returns a Map of issueNumber -> count.
 */
export async function fetchProjectVoteCounts(issueNumbers: number[]): Promise<Map<number, number>> {
  const supabase = getSupabaseClient();
  if (!supabase || issueNumbers.length === 0) return new Map();

  const { data, error } = await supabase
    .from('project_votes')
    .select('issue_number')
    .in('issue_number', issueNumbers);

  if (error) throw error;

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const n = row.issue_number as number;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return counts;
}

/**
 * Fetch which projects the current user has voted on.
 * Returns a Set of issue numbers the user has upvoted.
 */
export async function fetchUserProjectVotes(issueNumbers: number[]): Promise<Set<number>> {
  const supabase = getSupabaseClient();
  if (!supabase || issueNumbers.length === 0) return new Set();

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return new Set();

  const { data, error } = await supabase
    .from('project_votes')
    .select('issue_number')
    .eq('user_id', session.session.user.id)
    .in('issue_number', issueNumbers);

  if (error) throw error;

  return new Set((data ?? []).map((row) => row.issue_number as number));
}
