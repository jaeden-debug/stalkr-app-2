import { useCallback } from 'react';
import { useBillingStore } from '@/store/useBillingStore';
import type { SubscriptionPlan } from '@/types/database';

export function useEntitlements() {
  const plan = useBillingStore((s) => s.plan);
  const hasFeature = useBillingStore((s) => s.hasFeature);
  const loadEntitlement = useBillingStore((s) => s.loadEntitlement);

  const refresh = useCallback(() => loadEntitlement(), []);

  return { plan, hasFeature, refresh };
}
