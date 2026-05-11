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
