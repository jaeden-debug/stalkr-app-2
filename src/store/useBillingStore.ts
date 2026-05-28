import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionPlan } from '@/types/database';
import type { Entitlement } from '@/types/models';
import * as billingService from '@/services/billing';
import { useAuthStore } from './useAuthStore';
import { getPlanFeatures } from '@/constants/plans';

interface BillingState {
  plan: SubscriptionPlan;
  entitlement: Entitlement | null;
  isLoading: boolean;
  lastFetchedAt: string | null;

  loadEntitlement: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  canCreateGroup: () => boolean;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      plan: 'free',
      entitlement: null,
      isLoading: false,
      lastFetchedAt: null,

      loadEntitlement: async () => {
        const userId = useAuthStore.getState().session?.user?.id;
        if (!userId) return;
        set({ isLoading: true });
        const entitlement = await billingService.fetchEntitlement(userId);
        const plan = entitlement?.is_active ? entitlement.plan : 'free';
        set({ entitlement, plan, isLoading: false, lastFetchedAt: new Date().toISOString() });
      },

      hasFeature: (feature) => {
        const features = getPlanFeatures(get().plan);
        const val = (features as any)[feature];
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val > 0;
        return false;
      },

      canCreateGroup: () => {
        const features = getPlanFeatures(get().plan);
        return features.maxGroups > 0;
      },
    }),
    {
      name: 'billing-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ plan: s.plan, lastFetchedAt: s.lastFetchedAt }),
    },
  ),
);
