/**
 * Billing service — server-authoritative entitlement checks.
 * billingProvider abstraction: apple_iap | google_play_billing | stripe_web | manual_admin
 * Mobile IAP integration points are marked with TODO comments.
 */
import { supabase } from './supabase';
import type { Entitlement, Subscription } from '@/types/models';
import type { SubscriptionPlan, BillingProvider } from '@/types/database';

export async function fetchEntitlement(userId: string): Promise<Entitlement | null> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as Entitlement;
}

export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as Subscription;
}

/**
 * Grant entitlement — should be called from server/webhook, not client.
 * Exposed here for dev/admin manual grants only.
 */
export async function grantDevEntitlement(
  userId: string,
  plan: SubscriptionPlan,
): Promise<boolean> {
  const { error } = await supabase.from('entitlements').upsert(
    {
      user_id: userId,
      plan,
      is_active: true,
      source: 'manual_admin' as BillingProvider,
      expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  return !error;
}
