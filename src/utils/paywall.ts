/**
 * Paywall gates. Call these at feature entry points; if the user's plan doesn't
 * allow the action they get an upgrade alert routed to /subscription and the
 * call returns false. Admins always pass (handled in useBillingStore).
 */
import { Alert } from 'react-native';
import { useBillingStore } from '@/store/useBillingStore';
import type { PlanFeatures } from '@/constants/plans';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nav = { push: (path: any) => void };

function upgradeAlert(title: string, message: string, router: Nav) {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'See plans', onPress: () => router.push('/subscription') },
  ]);
}

/** Boolean feature gate (journeyMode, polygonZones, markerPhotos, etc.). */
export function requireFeature(feature: keyof PlanFeatures, router: Nav, label: string): boolean {
  if (useBillingStore.getState().hasFeature(feature)) return true;
  upgradeAlert(`${label} is a paid feature`, 'Upgrade your plan to unlock this.', router);
  return false;
}

/** Numeric limit gate (maxGroups, maxSavedPlaces, …). currentCount = how many exist now. */
export function requireLimit(
  feature: keyof PlanFeatures,
  currentCount: number,
  router: Nav,
  label: string,
): boolean {
  const billing = useBillingStore.getState();
  if (billing.withinLimit(feature, currentCount)) return true;
  const lim = billing.limitFor(feature);
  upgradeAlert(
    'Plan limit reached',
    `Your plan includes ${Number.isFinite(lim) ? lim : 'unlimited'} ${label}. Upgrade for more.`,
    router,
  );
  return false;
}
