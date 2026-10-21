-- Saved builds, one row per build a signed-in shopper keeps in their garage.
-- docs/superpowers/specs/2026-10-13-accounts-design.md
create table public.builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('visualize', 'builder')),
  name text not null default '' check (char_length(name) <= 80),
  url text not null check (char_length(url) <= 2048),
  data jsonb,
  still_key text check (still_key is null or char_length(still_key) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index builds_user_created on public.builds (user_id, created_at desc);

alter table public.builds enable row level security;

create policy "own builds: read"   on public.builds for select using (auth.uid() = user_id);
create policy "own builds: insert" on public.builds for insert with check (auth.uid() = user_id);
create policy "own builds: update" on public.builds for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own builds: delete" on public.builds for delete using (auth.uid() = user_id);

-- updated_at follows every change
create function public.builds_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger builds_touch before update on public.builds for each row execute function public.builds_touch();

-- at most 200 saved builds per account
create function public.builds_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.builds where user_id = new.user_id) >= 200 then
    raise exception 'garage full: 200 builds';
  end if;
  return new;
end $$;
create trigger builds_cap before insert on public.builds for each row execute function public.builds_cap();
