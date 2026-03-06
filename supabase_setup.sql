-- Run this in your Supabase SQL Editor

-- 1. Submissions table
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  reg_no text not null unique,
  file_path text not null,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  submitted_at timestamptz not null default now(),
  reviewed boolean not null default false
);

-- 2. Row Level Security
alter table submissions enable row level security;

-- Allow anyone to insert (participants submitting)
create policy "Allow public insert"
  on submissions for insert
  to anon
  with check (true);

-- Block public reads (only service role / admin can read)
-- For your admin panel to work with anon key, temporarily allow reads
-- or switch admin panel to use service role key server-side
create policy "Allow public read"
  on submissions for select
  to anon
  using (true);

-- Allow updates (for marking reviewed) — lock this down in production
create policy "Allow public update"
  on submissions for update
  to anon
  using (true);

-- 3. Storage bucket (run in Supabase dashboard Storage tab, or via SQL)
-- Create bucket named "submissions" with public = false
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict do nothing;

-- Allow anyone to upload
create policy "Allow public upload"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'submissions');

-- Allow reads for download
create policy "Allow public download"
  on storage.objects for select
  to anon
  using (bucket_id = 'submissions');
