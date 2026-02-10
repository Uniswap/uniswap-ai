-- ============================================================================
-- Project Votes – Upvoting for hackathon project submissions
-- ============================================================================
-- Projects are GitHub Issues identified by issue_number (integer).
-- Vote counts are NOT stored in a Supabase table (projects live in GitHub);
-- instead, counts are derived via COUNT(*) at query time.
-- ============================================================================

create table if not exists public.project_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  issue_number integer not null,
  created_at timestamptz not null default now(),
  unique(user_id, issue_number)
);

alter table public.project_votes enable row level security;

-- Anyone can read vote counts
create policy "Project votes are publicly readable"
  on public.project_votes for select
  using (true);

-- Authenticated users can vote
create policy "Authenticated users can vote on projects"
  on public.project_votes for insert
  with check (auth.uid() = user_id);

-- Users can remove their own votes
create policy "Users can remove own project votes"
  on public.project_votes for delete
  using (auth.uid() = user_id);

-- Index for fast count queries by issue_number
create index if not exists idx_project_votes_issue_number
  on public.project_votes(issue_number);

-- Index for fast lookup of a user's votes
create index if not exists idx_project_votes_user_id
  on public.project_votes(user_id);
