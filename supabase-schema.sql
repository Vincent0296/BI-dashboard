-- Run this in the Supabase SQL Editor

-- 1. Users Table
create table if not exists users (
  id text primary key,
  username text unique not null,
  password text not null,
  nickname text,
  avatar text,
  "lastLoginIp" text,
  "lastLoginTime" timestamp with time zone
);

-- 2. Comments Table
create table if not exists comments (
  id text primary key,
  project text not null,
  dimension text not null,
  period text not null,
  text text not null,
  "authorId" text not null,
  "authorName" text not null,
  date timestamp with time zone not null,
  "propertyType" text,
  management text
);

-- 3. Presets Table
create table if not exists presets (
  id text primary key,
  "userId" text not null,
  name text not null,
  filters jsonb not null,
  "selectedIndicators" jsonb,
  timestamp timestamp with time zone not null
);

-- 4. Feedback Table
create table if not exists feedback (
  id text primary key,
  "userId" text not null,
  content text not null,
  timestamp timestamp with time zone not null
);

-- Enable RLS but allow anon access for everything (Since this is an internal BI tool)
alter table users enable row level security;
alter table comments enable row level security;
alter table presets enable row level security;
alter table feedback enable row level security;

create policy "Allow all on users" on users for all using (true);
create policy "Allow all on comments" on comments for all using (true);
create policy "Allow all on presets" on presets for all using (true);
create policy "Allow all on feedback" on feedback for all using (true);
