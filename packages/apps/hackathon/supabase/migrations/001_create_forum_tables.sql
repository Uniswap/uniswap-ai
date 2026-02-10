-- ============================================================================
-- Uniswap AI Hackathon Forum – Database Schema
-- ============================================================================
-- Run this migration in the Supabase SQL Editor or via the CLI:
--   supabase db push
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles (synced from Supabase Auth via trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Forum Posts
-- ---------------------------------------------------------------------------
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'General',
  author_id uuid not null references public.profiles(id) on delete cascade,
  upvote_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_posts enable row level security;

create policy "Posts are publicly readable"
  on public.forum_posts for select
  using (true);

create policy "Authenticated users can create posts"
  on public.forum_posts for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own posts"
  on public.forum_posts for update
  using (auth.uid() = author_id);

create policy "Authors can delete own posts"
  on public.forum_posts for delete
  using (auth.uid() = author_id);

create index if not exists idx_forum_posts_created_at on public.forum_posts(created_at desc);
create index if not exists idx_forum_posts_category on public.forum_posts(category);
create index if not exists idx_forum_posts_upvote_count on public.forum_posts(upvote_count desc);

-- ---------------------------------------------------------------------------
-- 3. Forum Comments
-- ---------------------------------------------------------------------------
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  parent_id uuid references public.forum_comments(id) on delete cascade,
  content text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  upvote_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.forum_comments enable row level security;

create policy "Comments are publicly readable"
  on public.forum_comments for select
  using (true);

create policy "Authenticated users can create comments"
  on public.forum_comments for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own comments"
  on public.forum_comments for update
  using (auth.uid() = author_id);

create policy "Authors can delete own comments"
  on public.forum_comments for delete
  using (auth.uid() = author_id);

create index if not exists idx_forum_comments_post_id on public.forum_comments(post_id);
create index if not exists idx_forum_comments_parent_id on public.forum_comments(parent_id);

-- Trigger: increment comment_count on forum_posts
create or replace function public.update_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.forum_posts set comment_count = comment_count - 1 where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_comment_change on public.forum_comments;
create trigger on_comment_change
  after insert or delete on public.forum_comments
  for each row execute function public.update_post_comment_count();

-- ---------------------------------------------------------------------------
-- 4. Forum Votes
-- ---------------------------------------------------------------------------
create table if not exists public.forum_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);

alter table public.forum_votes enable row level security;

create policy "Votes are publicly readable"
  on public.forum_votes for select
  using (true);

create policy "Authenticated users can create votes"
  on public.forum_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own votes"
  on public.forum_votes for delete
  using (auth.uid() = user_id);

create index if not exists idx_forum_votes_target on public.forum_votes(target_type, target_id);

-- Triggers: keep upvote_count in sync
create or replace function public.update_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type = 'post' then
      update public.forum_posts set upvote_count = upvote_count + 1 where id = new.target_id;
    elsif new.target_type = 'comment' then
      update public.forum_comments set upvote_count = upvote_count + 1 where id = new.target_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.target_type = 'post' then
      update public.forum_posts set upvote_count = upvote_count - 1 where id = old.target_id;
    elsif old.target_type = 'comment' then
      update public.forum_comments set upvote_count = upvote_count - 1 where id = old.target_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_vote_change on public.forum_votes;
create trigger on_vote_change
  after insert or delete on public.forum_votes
  for each row execute function public.update_upvote_count();
