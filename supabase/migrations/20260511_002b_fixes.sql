-- Follow-up fix for 20260511_002 (review feedback)
-- Add index on subscriptions.plan_key (FK column)

create index if not exists subscriptions_plan_key_idx
  on public.subscriptions(plan_key);
