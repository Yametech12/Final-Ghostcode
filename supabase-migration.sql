-- Database schema setup for Epimetheus
-- Run this in your Supabase SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Create tables
create table if not exists public.advisor_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'AI Advisor Session',
  timestamp timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advisor_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references advisor_sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'model', 'system')),
  content text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.calibrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type_id text not null,
  answers jsonb not null default '{}'::jsonb,
  traits jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

-- Enable RLS
alter table public.advisor_sessions enable row level security;
alter table public.advisor_messages enable row level security;
alter table public.calibrations enable row level security;

-- Create policies
create policy "Users can view their own sessions"
  on advisor_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create their own sessions"
  on advisor_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on advisor_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sessions"
  on advisor_sessions for delete
  using (auth.uid() = user_id);

create policy "Users can view their own messages"
  on advisor_messages for select
  using (auth.uid() = user_id);

create policy "Users can create their own messages"
  on advisor_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own calibrations"
  on calibrations for select
  using (auth.uid() = user_id);

create policy "Users can create their own calibrations"
  on calibrations for insert
  with check (auth.uid() = user_id);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_advisor_sessions_updated_at
before update on advisor_sessions
for each row execute function update_updated_at_column();

-- Create indexes for performance
create index if not exists idx_advisor_sessions_user_id on advisor_sessions(user_id);
create index if not exists idx_advisor_sessions_updated_at on advisor_sessions(updated_at desc);
create index if not exists idx_advisor_messages_session_id on advisor_messages(session_id);
create index if not exists idx_advisor_messages_timestamp on advisor_messages(timestamp asc);
create index if not exists idx_calibrations_user_id on calibrations(user_id);
create index if not exists idx_calibrations_timestamp on calibrations(timestamp desc);

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on table public.advisor_sessions to anon, authenticated;
grant all on table public.advisor_messages to anon, authenticated;
grant all on table public.calibrations to anon, authenticated;