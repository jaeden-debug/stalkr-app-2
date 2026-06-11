/**
 * RevenueCat (Apple IAP) wrapper.
 *
 * Lazily required so the JS bundle + tsc work even before
 * `react-native-purchases` is installed / in a build that lacks it — in that
 * case everything falls back to the free plan. Once the package is installed,
 * the key is set (EXPO_PUBLIC_REVENUECAT_IOS_KEY), and RevenueCat is configured
 * with entitlements named "pro" and "crew", this becomes the source of truth
 * for the user's plan on iOS.
 *
 * SETUP:
 *   1. App Store Connect → Subscriptions → create products
 *      (e.g. stalkr.pro.monthly $4.99, stalkr.crew.monthly $9.99).
 *   2. RevenueCat → add the iOS app + products; create entitlements "pro" and
 *      "crew"; attach products; put both in the "default" offering.
 *   3. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY in the app env.
 */
import type { SubscriptionPlan } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */
let Purchases: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-purchases');
  Purchases = mod?.default ?? mod;
} catch {
  Purchases = null;
}

let configured = false;

export const revenueCatAvailable = () => !!Purchases;

export async function configureRevenueCat(appUserId: string | null): Promise<void> {
  if (!Purchases) return;
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (!apiKey) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey, appUserID: appUserId ?? undefined });
      configured = true;
    } else if (appUserId) {
      await Purchases.logIn(appUserId);
    }
  } catch {
    /* configure is best-effort */
  }
}

export function planFromCustomerInfo(info: any): SubscriptionPlan {
  // Single paid plan: ANY active entitlement = full-access Pro. This is robust to
  // the entitlement's identifier (e.g. "pro", "stalkr Pro") since there's only one.
  const active = info?.entitlements?.active ?? {};
  return Object.keys(active).length > 0 ? 'pro' : 'free';
}

export async function getActivePlan(): Promise<SubscriptionPlan> {
  if (!Purchases) return 'free';
  try {
    return planFromCustomerInfo(await Purchases.getCustomerInfo());
  } catch {
    return 'free';
  }
}

/** Returns RevenueCat packages for the current offering (for the paywall). */
export async function getOfferingPackages(): Promise<any[]> {
  if (!Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchasePackage(pkg: any): Promise<SubscriptionPlan | null> {
  if (!Purchases || !pkg) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return planFromCustomerInfo(customerInfo);
  } catch (e: any) {
    if (e?.userCancelled) return null;
    throw e;
  }
}

export async function restorePurchases(): Promise<SubscriptionPlan> {
  if (!Purchases) return 'free';
  try {
    return planFromCustomerInfo(await Purchases.restorePurchases());
  } catch {
    return 'free';
  }
}
