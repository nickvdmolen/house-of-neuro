-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Groups table
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null default 0
);

-- Students table
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  group_id uuid references groups(id),
  points integer not null default 0,
  photo text
);

-- Teachers table
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  approved boolean not null default false
);

-- Enum type for award target
create type if not exists award_target as enum ('group', 'student');

-- Awards table
create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  type award_target not null,
  target_id uuid not null,
  amount integer not null,
  reason text
);

-- Badge definitions
create table if not exists badges (
  id text primary key,
  title text not null,
  image text,
  requirement text
);

-- Relation between students and badges
create table if not exists student_badges (
  student_id uuid references students(id) on delete cascade,
  badge_id text references badges(id) on delete cascade,
  primary key (student_id, badge_id)
);
