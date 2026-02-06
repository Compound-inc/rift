/**
 * Shared types and mappers for Autumn-based quota (used by usage page and quota-client).
 */

export interface AutumnFeature {
  usage?: number;
  included_usage?: number;
  next_reset_at?: number | null;
}

export interface QuotaData {
  currentUsage: number;
  limit: number;
  quotaConfigured: boolean;
}

export interface QuotaInfo {
  standard: QuotaData;
  premium: QuotaData;
  nextResetDate?: number;
}

export function toQuotaData(feature: AutumnFeature | undefined): QuotaData {
  if (!feature) {
    return { currentUsage: 0, limit: 0, quotaConfigured: false };
  }
  const usage = feature.usage ?? 0;
  const limit = feature.included_usage ?? 0;
  return {
    currentUsage: usage,
    limit,
    quotaConfigured: limit > 0,
  };
}

export function getNextResetDate(
  standard: AutumnFeature | undefined,
  premium: AutumnFeature | undefined
): number | undefined {
  const at = standard?.next_reset_at ?? premium?.next_reset_at;
  return at != null && at > 0 ? at : undefined;
}

export function mapAutumnToQuotaInfo(features: Record<string, AutumnFeature> | undefined): QuotaInfo {
  const standard = features?.standard;
  const premium = features?.premium;
  return {
    standard: toQuotaData(standard),
    premium: toQuotaData(premium),
    nextResetDate: getNextResetDate(standard, premium),
  };
}

export const UNCONFIGURED_QUOTA_INFO: QuotaInfo = {
  standard: { currentUsage: 0, limit: 0, quotaConfigured: false },
  premium: { currentUsage: 0, limit: 0, quotaConfigured: false },
  nextResetDate: undefined,
};
