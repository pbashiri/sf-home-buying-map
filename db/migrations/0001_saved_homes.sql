create table if not exists saved_homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  horizon integer not null default 10,
  notes text,
  share_token text unique,
  share_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lat, lng)
);

create index if not exists saved_homes_user_id_idx on saved_homes (user_id);

create table if not exists saved_home_messages (
  id uuid primary key default gen_random_uuid(),
  saved_home_id uuid not null references saved_homes(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_home_messages_home_id_idx on saved_home_messages (saved_home_id);
create index if not exists saved_home_messages_user_id_idx on saved_home_messages (user_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_homes_set_updated_at on saved_homes;
create trigger saved_homes_set_updated_at
before update on saved_homes
for each row execute function set_updated_at();

alter table saved_homes enable row level security;
alter table saved_home_messages enable row level security;

drop policy if exists "Users can read their saved homes" on saved_homes;
create policy "Users can read their saved homes"
on saved_homes for select
using (auth.uid() = user_id or share_enabled = true);

drop policy if exists "Users can insert saved homes" on saved_homes;
create policy "Users can insert saved homes"
on saved_homes for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their saved homes" on saved_homes;
create policy "Users can update their saved homes"
on saved_homes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their saved homes" on saved_homes;
create policy "Users can delete their saved homes"
on saved_homes for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read messages for their saved homes" on saved_home_messages;
create policy "Users can read messages for their saved homes"
on saved_home_messages for select
using (
  auth.uid() = user_id
  and exists (
    select 1 from saved_homes
    where saved_homes.id = saved_home_messages.saved_home_id
      and saved_homes.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert messages for their saved homes" on saved_home_messages;
create policy "Users can insert messages for their saved homes"
on saved_home_messages for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from saved_homes
    where saved_homes.id = saved_home_messages.saved_home_id
      and saved_homes.user_id = auth.uid()
  )
);
