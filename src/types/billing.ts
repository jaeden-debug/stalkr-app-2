import type { BillingProvider, SubscriptionPlan } from './database';

export interface ProductOffering {
  id: string;
  plan: SubscriptionPlan;
  title: string;
  description: string;
  priceString: string;
  price: number;
  currencyCode: string;
  periodUnit: 'month' | 'year';
  /** Native product ID (Apple SKU or Google product ID) */
  providerProductId: string;
}

export interface PurchaseResult {
  success: boolean;
  plan?: SubscriptionPlan;
  provider?: BillingProvider;
  transactionId?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredPlan?: SubscriptionPlan;
  error?: string;
}

/** Abstraction layer — implement for each platform */
export interface BillingAdapter {
  initialize(): Promise<void>;
  getOfferings(): Promise<ProductOffering[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<RestoreResult>;
  getActiveSubscription(): Promise<SubscriptionPlan | null>;
}
