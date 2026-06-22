export type IntegrationProviderKey =
  | "shopify"
  | "meta"
  | "plaid"
  | "quickbooks"
  | "google_ads"
  | "xero";

type RequiredField = {
  key: string;
  label: string;
};

const REQUIRED_FIELDS: Record<IntegrationProviderKey, RequiredField[]> = {
  shopify: [
    { key: "shop_domain", label: "Store connected" },
    { key: "orders_synced", label: "Orders synced" },
    { key: "products_synced", label: "Products synced" },
    { key: "last_sync_at", label: "Recent sync" },
  ],
  meta: [
    { key: "ad_account_selected", label: "Ad account selected" },
    { key: "insights_backfill_completed", label: "Campaign history loaded" },
    { key: "last_sync_at", label: "Recent sync" },
  ],
  plaid: [
    { key: "account_linked", label: "Bank account linked" },
    { key: "initial_sync_completed", label: "Transactions imported" },
    { key: "last_sync_at", label: "Recent sync" },
  ],
  quickbooks: [
    { key: "company_selected", label: "Company selected" },
    { key: "books_initial_sync_completed", label: "Books synced" },
    { key: "last_sync_at", label: "Recent sync" },
  ],
  google_ads: [
    { key: "client_account_selected", label: "Client account selected" },
    { key: "insights_backfill_completed", label: "Campaign history loaded" },
    { key: "last_sync_at", label: "Recent sync" },
  ],
  xero: [
    { key: "tenant_selected", label: "Organisation selected" },
    { key: "books_initial_sync_completed", label: "Books synced" },
    { key: "last_sync_at", label: "Recent sync" },
  ],
};

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function computeIntegrationDataCoverage(input: {
  provider: IntegrationProviderKey;
  status: "connected" | "syncing" | "error" | "disconnected";
  comingSoon?: boolean;
  fields: Record<string, unknown>;
}): number {
  if (input.comingSoon || input.status === "disconnected") return 0;

  const required = REQUIRED_FIELDS[input.provider];
  const present = required.filter((field) => isPresent(input.fields[field.key])).length;
  return Math.round((present / required.length) * 100);
}

export function computeOverallDataCoverage(
  cards: Array<{ data_coverage_pct: number; coming_soon?: boolean }>,
): number {
  const active = cards.filter((card) => !card.coming_soon);
  if (active.length === 0) return 0;

  const total = active.reduce((sum, card) => sum + card.data_coverage_pct, 0);
  return Math.round(total / active.length);
}

export function buildIntegrationsHubSummary(
  cards: Array<{ provider: IntegrationProviderKey; status: string; coming_soon?: boolean }>,
): string | null {
  const disconnected = cards.filter(
    (card) => !card.coming_soon && card.status === "disconnected",
  );

  if (disconnected.length === 0) return null;

  const labels = disconnected.map((card) => {
    switch (card.provider) {
      case "meta":
        return "Meta Ads";
      case "plaid":
        return "Bank (Plaid)";
      case "quickbooks":
        return "QuickBooks";
      case "google_ads":
        return "Google Ads";
      default:
        return card.provider;
    }
  });

  if (labels.length === 1) {
    return `Connect ${labels[0]} to unlock fuller briefings.`;
  }

  if (labels.length === 2) {
    return `Connect ${labels[0]} and ${labels[1]} to unlock fuller briefings.`;
  }

  return `Connect ${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)} to unlock fuller briefings.`;
}
