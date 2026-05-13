# Admin Setup

To grant the `admin` role to a user (so they can access `admin.impluxa.com`), set the `role` claim in `auth.users.raw_app_meta_data`:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'pablo@impluxa.com';
```

The user must sign out and sign in again for the JWT to refresh with the new claim.

RLS policies read this claim via the `public.is_admin()` helper:

```sql
select public.is_admin();  -- true if JWT has role=admin
```

## activity_log write behavior

`activity_log` has RLS enabled with **no INSERT/UPDATE/DELETE policy** for authenticated or anon roles. Only `service_role` (which bypasses RLS) can write to it. This is intentional.

All writes go through server-side code using `getServiceSupabase()` (which uses `SUPABASE_SERVICE_ROLE_KEY`). Tenant members can only SELECT rows for their own tenant via `activity_member_read`.

```ts
// Correct: write via service_role client
const supabase = getServiceSupabase();
await supabase
  .from("activity_log")
  .insert({ tenant_id, actor_id, action, payload });
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
