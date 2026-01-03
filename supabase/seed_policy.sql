-- TEMPORARY: Allow anonymous inserts for seeding
-- Run this to allow the seed script to populate the database without authentication.

-- Apps
create policy "Allow anonymous insert for apps"
on apps for insert
with check (true);

create policy "Allow anonymous update for apps"
on apps for update
using (true);

-- Todos
create policy "Allow anonymous insert for todos"
on todos for insert
with check (true);

create policy "Allow anonymous update for todos"
on todos for update
using (true);

-- Improvements
create policy "Allow anonymous insert for improvements"
on improvements for insert
with check (true);

create policy "Allow anonymous update for improvements"
on improvements for update
using (true);
