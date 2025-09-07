-- Supabase schema for Neuromarketing Housepoints
-- Create tables

create table if not exists students (
  id text primary key,
  name text,
  email text unique,
  password text,
  "groupId" text,
  points integer default 0,
  badges text[] default '{}',
  photo text,
  "tempCode" text,
  "resetToken" text
);

create table if not exists groups (
  id text primary key,
  name text,
  points integer default 0
);

create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  target text check (target in ('student','group')),
  target_id uuid not null,
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
