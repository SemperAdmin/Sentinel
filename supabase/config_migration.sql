
-- App Config Table for simple key-value storage (e.g., admin password reference)
create table if not exists app_config (
  key text primary key,
  value text
);

-- Enable RLS
alter table app_config enable row level security;

-- Allow public read access (so the client can fetch the password reference to check against)
-- NOTE: In a production environment, you should use RPC or hashing to avoid exposing the password.
-- For this portfolio app, as requested, we allow reading the value.
create policy "Public read config" 
on app_config for select 
using ( true );

-- Insert default admin password
insert into app_config (key, value)
values ('admin_password', 'admin')
on conflict (key) do nothing;
