import type { SubscriptionPlan } from '@/types/database';

export interface PlanFeatures {
  maxGroups: number;
  maxMembersPerGroup: number;
  maxSavedPlaces: number;
  maxSessionsPerGroup: number;
  trailHistoryHours: number;
  polygonZones: boolean;
  zoneAlerts: boolean;
  markerPhotos: boolean;
  emergencyContacts: boolean;
  journeyMode: boolean;
  watcherNotifications: boolean;
  exportCoordinates: boolean;
  approximateLocation: boolean;
  adminControls: boolean;
  enforcedTracking: boolean;
  groupEventTimeline: boolean;
  prioritySafety: boolean;
}

export const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  free: {
    maxGroups: 2,
    maxMembersPerGroup: 5,
    maxSavedPlaces: 3,
    maxSessionsPerGroup: 1,
    trailHistoryHours: 4,
    polygonZones: false,
    zoneAlerts: false,
    // Photos are free. A marker without a photo is much less useful for the
    // core job — "this is where camp is, here's what it looks like" — and
    // gating it meant PhotoGallery rendered no add button at all, so zero
    // photos were ever uploaded by anyone.
    markerPhotos: true,
    emergencyContacts: false,
    journeyMode: false,
    watcherNotifications: false,
    exportCoordinates: false,
    approximateLocation: true,
    adminControls: false,
    enforcedTracking: false,
    groupEventTimeline: false,
    prioritySafety: false,
  },
  // Single paid plan ($9.99/mo) — FULL access, generous caps.
  pro: {
    maxGroups: 100,
    maxMembersPerGroup: 200,
    maxSavedPlaces: 1000,
    maxSessionsPerGroup: 100,
    trailHistoryHours: 720,
    polygonZones: true,
    zoneAlerts: true,
    markerPhotos: true,
    emergencyContacts: true,
    journeyMode: true,
    watcherNotifications: true,
    exportCoordinates: true,
    approximateLocation: true,
    adminControls: true,
    enforcedTracking: true,
    groupEventTimeline: true,
    prioritySafety: true,
  },
  crew: {
    maxGroups: 50,
    maxMembersPerGroup: 100,
    maxSavedPlaces: 500,
    maxSessionsPerGroup: 50,
    trailHistoryHours: 168, // 7 days
    polygonZones: true,
    zoneAlerts: true,
    markerPhotos: true,
    emergencyContacts: true,
    journeyMode: true,
    watcherNotifications: true,
    exportCoordinates: true,
    approximateLocation: true,
    adminControls: true,
    enforcedTracking: true,
    groupEventTimeline: true,
    prioritySafety: true,
  },
};

export const PLAN_DISPLAY: Record<SubscriptionPlan, { label: string; tagline: string; color: string }> = {
  free: {
    label: 'Free',
    tagline: 'Get started tracking your crew',
    color: '#6b7280',
  },
  pro: {
    label: 'Pro',
    tagline: 'Full safety & tracking suite',
    color: '#22c55e',
  },
  crew: {
    label: 'Crew',
    tagline: 'Team-scale operations & control',
    color: '#3b82f6',
  },
};

export function getPlanFeatures(plan: SubscriptionPlan): PlanFeatures {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free;
}

export function hasFeature(plan: SubscriptionPlan, feature: keyof PlanFeatures): boolean {
  const features = getPlanFeatures(plan);
  const val = features[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  return false;
}
