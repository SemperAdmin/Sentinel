
-- Idea Feedback Table
create table if not exists idea_feedback (
  id uuid default gen_random_uuid() primary key,
  idea_id text references ideas(id) on delete cascade,
  author text,
  email text,
  text text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table idea_feedback enable row level security;

-- Policies
-- Anyone can read feedback
create policy "Public read feedback" 
on idea_feedback for select 
using ( true );

-- Anyone can insert feedback (public submission)
create policy "Public insert feedback" 
on idea_feedback for insert 
with check ( true );

-- Only admins (via profiles or app logic) or owners can delete/update? 
-- For now, let's say only admins can delete.
create policy "Admins can delete feedback" 
on idea_feedback for delete 
using ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin') 
);
