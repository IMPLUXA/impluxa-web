-- Fix 1b: Re-grant EXECUTE on is_admin() to authenticated so RLS policies
-- that call public.is_admin() work when the session role is authenticated.
-- anon stays revoked (landing form uses anon, never needs admin check).
grant execute on function public.is_admin() to authenticated;
