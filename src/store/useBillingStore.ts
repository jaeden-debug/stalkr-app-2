import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionPlan } from '@/types/database';
import type { Entitlement } from '@/types/models';
import * as billingService from '@/services/billing';
import {
  configureRevenueCat, getActivePlan, revenueCatAvailable,
  getOfferingPackages, purchasePackage, restorePurchases,
} from '@/services/revenuecat';
import { useAuthStore } from './useAuthStore';
import { getPlanFeatures, type PlanFeatures } from '@/constants/plans';

/** Full-access bypass for the owner account(s). */
const ADMIN_EMAILS = ['admin@zylx.ai'];

interface BillingState {
  plan: SubscriptionPlan;
  isAdmin: boolean;
  entitlement: Entitlement | null;
  isLoading: boolean;
  lastFetchedAt: string | null;

  loadEntitlement: () => Promise<void>;
  features: () => PlanFeatures;
  hasFeature: (feature: keyof PlanFeatures) => boolean;
  /** Numeric limit for a feature (Infinity for admin). */
  limitFor: (feature: keyof PlanFeatures) => number;
  /** True if a count is still under the plan limit (admin always true). */
  withinLimit: (feature: keyof PlanFeatures, currentCount: number) => boolean;
  canCreateGroup: () => boolean;

  // Purchases (RevenueCat / Apple IAP)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPackages: () => Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  purchase: (pkg: any) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      plan: 'free',
      isAdmin: false,
      entitlement: null,
      isLoading: false,
      lastFetchedAt: null,

      loadEntitlement: async () => {
        const auth = useAuthStore.getState();
        const userId = auth.user?.id ?? auth.session?.user?.id;
        const email = (auth.user?.email ?? auth.session?.user?.email ?? '').toLowerCase();

        // Admin bypass — full access regardless of any subscription.
        if (email && ADMIN_EMAILS.includes(email)) {
          set({ plan: 'pro', isAdmin: true, isLoading: false, lastFetchedAt: new Date().toISOString() });
          return;
        }
        set({ isAdmin: false });
        if (!userId) { set({ plan: 'free' }); return; }

        set({ isLoading: true });
        try {
          await configureRevenueCat(userId);
          let plan: SubscriptionPlan = 'free';
          let entitlement: Entitlement | null = null;
          if (revenueCatAvailable()) {
            // Apple IAP is the source of truth on device.
            plan = await getActivePlan();
          } else {
            // Fallback (web/Android entitlement synced to Supabase).
            entitlement = await billingService.fetchEntitlement(userId);
            plan = entitlement?.is_active ? entitlement.plan : 'free';
          }
          set({ plan, entitlement, isLoading: false, lastFetchedAt: new Date().toISOString() });
        } catch {
          set({ isLoading: false });
        }
      },

      features: () => getPlanFeatures(get().plan),

      hasFeature: (feature) => {
        if (get().isAdmin) return true;
        const val = getPlanFeatures(get().plan)[feature];
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val > 0;
        return false;
      },

      limitFor: (feature) => {
        if (get().isAdmin) return Infinity;
        const val = getPlanFeatures(get().plan)[feature];
        return typeof val === 'number' ? val : (val ? Infinity : 0);
      },

      withinLimit: (feature, currentCount) => {
        if (get().isAdmin) return true;
        const val = getPlanFeatures(get().plan)[feature];
        if (typeof val === 'number') return currentCount < val;
        return !!val;
      },

      canCreateGroup: () => get().isAdmin || getPlanFeatures(get().plan).maxGroups > 0,

      getPackages: () => getOfferingPackages(),

      purchase: async (pkg) => {
        const plan = await purchasePackage(pkg);
        if (plan) {
          set({ plan, lastFetchedAt: new Date().toISOString() });
          return true;
        }
        return false;
      },

      restore: async () => {
        const plan = await restorePurchases();
        set({ plan, lastFetchedAt: new Date().toISOString() });
        return plan !== 'free';
      },
    }),
    {
      name: 'billing-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ plan: s.plan, isAdmin: s.isAdmin, lastFetchedAt: s.lastFetchedAt }),
    },
  ),
);
