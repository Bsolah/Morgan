import type { Database } from "@morgan/db";
import {
  buildIntegrationsHubSummary,
  computeIntegrationDataCoverage,
  computeOverallDataCoverage,
  type IntegrationProviderKey,
} from "@morgan/integrations";
import { getGoogleAdsIntegrationForStore } from "./google-ads-integration-service.js";
import { getMetaIntegrationForStore } from "./meta-integration-service.js";
import { getPlaidIntegrationForStore } from "./plaid-integration-service.js";
import { getQuickBooksIntegrationForStore } from "./quickbooks-integration-service.js";
import { getShopifyIntegrationForStore } from "./shopify-integration-service.js";
import { getXeroIntegrationForStore } from "./xero-integration-service.js";

export type IntegrationHubCardView = {
  provider: IntegrationProviderKey;
  label: string;
  status: "connected" | "syncing" | "error" | "disconnected";
  last_sync_at: string | null;
  error_message: string | null;
  data_coverage_pct: number;
  coming_soon: boolean;
  details: Record<string, unknown>;
};

export type IntegrationsHubView = {
  integrations: IntegrationHubCardView[];
  overall_data_coverage_pct: number;
  summary_message: string | null;
};

const PROVIDER_LABELS: Record<IntegrationProviderKey, string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  plaid: "Bank (Plaid)",
  quickbooks: "QuickBooks",
  google_ads: "Google Ads",
  xero: "Xero",
};

function coverageFields(
  provider: IntegrationProviderKey,
  details: Record<string, unknown>,
): Record<string, unknown> {
  switch (provider) {
    case "shopify":
      return {
        shop_domain: details.shop_domain,
        orders_synced: details.orders_sync_completed || details.partial_brief_available,
        products_synced: details.products_sync_completed,
        last_sync_at: details.last_sync_at,
      };
    case "meta":
      return {
        ad_account_selected: Boolean(details.ad_account_id),
        insights_backfill_completed: details.insights_backfill_completed,
        last_sync_at: details.last_successful_sync_at ?? details.last_sync_at,
      };
    case "plaid":
      return {
        account_linked: Boolean(details.account_mask || details.institution_name),
        initial_sync_completed: details.initial_sync_completed,
        last_sync_at: details.last_sync_at,
      };
    case "quickbooks":
      return {
        company_selected: Boolean(details.company_id),
        books_initial_sync_completed: details.books_initial_sync_completed,
        last_sync_at: details.last_sync_at,
      };
    case "google_ads":
      return {
        client_account_selected: Boolean(details.client_customer_id),
        insights_backfill_completed: details.insights_backfill_completed,
        last_sync_at: details.last_sync_at,
      };
    case "xero":
      return {
        tenant_selected: Boolean(details.tenant_id),
        books_initial_sync_completed: details.books_initial_sync_completed,
        last_sync_at: details.last_sync_at,
      };
  }
}

function resolveErrorMessage(details: Record<string, unknown>): string | null {
  const syncError = details.sync_error_message;
  if (typeof syncError === "string" && syncError.trim().length > 0) return syncError;

  const errorMessage = details.error_message;
  if (typeof errorMessage === "string" && errorMessage.trim().length > 0) return errorMessage;

  return null;
}

function resolveLastSyncAt(details: Record<string, unknown>): string | null {
  const lastSuccessful = details.last_successful_sync_at;
  if (typeof lastSuccessful === "string") return lastSuccessful;

  const lastSync = details.last_sync_at;
  return typeof lastSync === "string" ? lastSync : null;
}

function toHubCard(
  provider: IntegrationProviderKey,
  details: Record<string, unknown>,
  options: { comingSoon?: boolean } = {},
): IntegrationHubCardView {
  const status = (details.status as IntegrationHubCardView["status"]) ?? "disconnected";
  const comingSoon = options.comingSoon ?? false;
  const dataCoveragePct = computeIntegrationDataCoverage({
    provider,
    status,
    comingSoon,
    fields: coverageFields(provider, details),
  });

  return {
    provider,
    label: PROVIDER_LABELS[provider],
    status,
    last_sync_at: resolveLastSyncAt(details),
    error_message: resolveErrorMessage(details),
    data_coverage_pct: dataCoveragePct,
    coming_soon: comingSoon,
    details,
  };
}

export async function getIntegrationsHubForStore(
  db: Database,
  storeId: string,
): Promise<IntegrationsHubView> {
  const [shopify, meta, plaid, quickbooks, googleAds, xero] = await Promise.all([
    getShopifyIntegrationForStore(db, storeId),
    getMetaIntegrationForStore(db, storeId),
    getPlaidIntegrationForStore(db, storeId),
    getQuickBooksIntegrationForStore(db, storeId),
    getGoogleAdsIntegrationForStore(db, storeId),
    getXeroIntegrationForStore(db, storeId),
  ]);

  const integrations = [
    toHubCard("shopify", shopify),
    toHubCard("meta", meta),
    toHubCard("plaid", plaid),
    toHubCard("quickbooks", quickbooks),
    toHubCard("google_ads", googleAds),
    toHubCard("xero", xero, { comingSoon: true }),
  ];

  return {
    integrations,
    overall_data_coverage_pct: computeOverallDataCoverage(integrations),
    summary_message: buildIntegrationsHubSummary(integrations),
  };
}
