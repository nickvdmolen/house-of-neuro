-- Supabase schema for Neuromarketing Housepoints
-- Create tables

create table if not exists semesters (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists students (
  id text primary key,
  name text,
  email text unique,
  password text,
  "semesterId" text,
  "groupId" text,
  points integer default 0,
  "streakFreezeTotal" integer default 2,
  badges text[] default '{}',
  photo text,
  bingo jsonb default '{}'::jsonb,
  "bingoMatches" jsonb default '{}'::jsonb,
  "lastWeekRewarded" text,
  "showRankPublic" boolean default true,
  "tempCode" text,
  "resetToken" text
);

alter table students add column if not exists bingo jsonb default '{}'::jsonb;
alter table students add column if not exists "bingoMatches" jsonb default '{}'::jsonb;
alter table students add column if not exists "lastWeekRewarded" text;
alter table students add column if not exists "showRankPublic" boolean default true;
alter table students add column if not exists "semesterId" text;
alter table students add column if not exists "streakFreezeTotal" integer default 2;
alter table students alter column "showRankPublic" set default true;

create table if not exists groups (
  id text primary key,
  name text,
  "semesterId" text,
  points integer default 0
);

create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  target text check (target in ('student','group')),
  target_id uuid not null,
  "semesterId" text,
  amount integer,
  reason text
);

create table if not exists badge_defs (
  id text primary key,
  title text,
  image text,
  requirement text
);

create table if not exists teachers (
  id text primary key,
  email text unique,
  "passwordHash" text,
  approved boolean default false,
  "resetToken" text
);

create table if not exists app_settings (
  id text primary key,
  "bingoHintsEnabled" boolean default false
);

alter table app_settings add column if not exists "bingoHintsEnabled" boolean default false;

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time,
  type text not null, -- e.g., 'lecture', 'workshop', 'seminar'
  title text not null,
  "semesterId" text,
  created_by text references teachers(id),
  created_at timestamptz default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  student_id text references students(id) on delete cascade,
  present boolean default false,
  streak_freeze boolean default false,
  marked_at timestamptz default now(),
  unique(meeting_id, student_id)
);

create table if not exists peer_events (
  id text primary key,
  title text not null,
  description text,
  budget integer not null default 0,
  active boolean default true,
  allow_own_group boolean default false,
  allow_other_groups boolean default true,
  "semesterId" text,
  created_at timestamptz default now()
);

create table if not exists peer_awards (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  from_student_id text references students(id) on delete cascade,
  event_id text references peer_events(id) on delete set null,
  target text check (target in ('student','group','class')),
  target_id text,
  "semesterId" text,
  amount integer,
  total_amount integer,
  reason text,
  recipients text[],
  weekKey text
);

alter table groups add column if not exists "semesterId" text;
alter table awards add column if not exists "semesterId" text;
alter table meetings add column if not exists "semesterId" text;
alter table peer_events add column if not exists "semesterId" text;
alter table peer_awards add column if not exists "semesterId" text;
alter table attendance add column if not exists streak_freeze boolean default false;

-- Example badge definitions (replace public URL with your project URL)
insert into badge_defs (id, title, image, requirement) values
  ('eeg', 'EEG', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/eeg.jpg', ''),
  ('eeg2', 'EEG2', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/eeg2.webp', ''),
  ('experiment', 'Experiment', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/experiment.webp', ''),
  ('facereader', 'Facereader', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/facereader.webp', ''),
  ('excursie', 'Excursie', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/excursie.webp', ''),
  ('groupname', 'Groepsnaam & mascotte', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/groupname.webp', ''),
  ('homework', 'Homework', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/homework.webp', ''),
  ('kennistoets', 'Kennistoets', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/kennistoets.webp', ''),
  ('leeswerk', 'Leeswerk', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/leeswerk.webp', ''),
  ('lunch', 'Lunch', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/lunch.webp', ''),
  ('meeting', 'Meeting with commissioner', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/meeting.webp', ''),
  ('minorbehaald', 'Minor behaald', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/minorbehaald.webp', ''),
  ('namen', 'Namen badge', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/namen-badge.webp', ''),
  ('partycommittee', 'Party committee', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/partycommittee.webp', ''),
  ('project', 'Project', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/project.webp', ''),
  ('pubquiz', 'Pubquiz', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/pubquiz.webp', ''),
  ('pupil-labs', 'Pupil labs', 'https://rgyukpzginlyihyijbfk.supabase.co/storage/v1/object/public/hon/images/pupil-labs.webp', '');

-- Storage policies to allow authenticated uploads to the `hon` bucket
create policy "authenticated can upload images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'hon' and (storage.foldername(name))[1] = 'images');

create policy "authenticated can update images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'hon' and (storage.foldername(name))[1] = 'images');

create policy "authenticated can read images"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'hon' and (storage.foldername(name))[1] = 'images');
