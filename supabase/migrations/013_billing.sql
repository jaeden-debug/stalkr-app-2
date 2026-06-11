-- 013_billing.sql — entitlements + subscriptions (idempotent).
-- iOS uses RevenueCat/Apple IAP as the source of truth on device. This table is
-- the server-side fallback for web/Android and for a RevenueCat webhook to sync
-- into, so the app can read a plan even without the native SDK.

create table if not exists public.entitlements (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  plan        text not null default 'free' check (plan in ('free','pro','crew')),
  is_active   boolean not null default true,
  source      text,                 -- apple_iap | google_play | stripe_web | manual_admin | revenuecat
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  plan         text not null check (plan in ('free','pro','crew')),
  provider     text not null,        -- apple_iap | google_play | stripe_web | revenuecat
  provider_ref text,                 -- RC app_user_id / Stripe sub id / original_transaction_id
  status       text not null default 'active',
  current_period_end timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);

alter table public.entitlements  enable row level security;
alter table public.subscriptions enable row level security;

-- Users may READ their own entitlement/subscription. Writes are server-side only
-- (service role via the RevenueCat/Stripe webhook), so no insert/update policy.
do $$ begin
  create policy "entitlements_self_read" on public.entitlements
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "subscriptions_self_read" on public.subscriptions
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
