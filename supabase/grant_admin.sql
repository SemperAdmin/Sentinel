-- ---------------------------------------------------------------------------
-- GRANT ADMIN ROLE SCRIPT
-- ---------------------------------------------------------------------------
-- Usage:
-- 1. Replace 'your_email@example.com' below with your actual email address used in Supabase Auth.
-- 2. Run this script in the Supabase SQL Editor.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  target_email TEXT := 'your_email@example.com'; -- <<< CHANGE THIS TO YOUR EMAIL
  target_user_id UUID;
BEGIN
  -- Find the user ID from auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found in auth.users', target_email;
  ELSE
    -- Insert or Update the profile with admin role
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, target_email, 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
    
    RAISE NOTICE 'Successfully granted admin role to % (ID: %)', target_email, target_user_id;
  END IF;
END $$;
