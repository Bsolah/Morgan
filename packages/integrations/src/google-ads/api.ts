export const GOOGLE_ADS_API_VERSION = "v18";
export const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GoogleAdsApiError";
  }
}

export function normalizeGoogleAdsCustomerId(resourceNameOrId: string): string {
  const value = resourceNameOrId.trim();
  if (value.startsWith("customers/")) {
    return value.slice("customers/".length);
  }
  return value.replace(/-/g, "");
}

export function formatGoogleAdsCustomerId(customerId: string): string {
  const digits = customerId.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return customerId;
}

type GoogleAdsSearchStreamBatch = {
  results?: Array<Record<string, unknown>>;
  error?: { message?: string; code?: number };
};

type GoogleAdsSearchResponse = {
  results?: Array<Record<string, unknown>>;
  nextPageToken?: string;
  error?: { message?: string; code?: number; status?: string };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGoogleAdsRateLimitError(status: number, message?: string): boolean {
  if (status === 429) return true;
  if (!message) return false;
  const normalized = message.toUpperCase();
  return normalized.includes("RESOURCE_EXHAUSTED") || normalized.includes("RATE");
}

export async function fetchWithGoogleAdsRateLimitBackoff<T>(
  request: () => Promise<Response>,
  options?: { maxRetries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 5;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await request();
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };

    if (res.ok) {
      return body;
    }

    const message = (body as { error?: { message?: string } }).error?.message;
    if (!isGoogleAdsRateLimitError(res.status, message) || attempt === maxRetries) {
      throw new GoogleAdsApiError(message ?? `Google Ads API request failed: ${res.status}`, res.status);
    }

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : baseDelayMs * 2 ** attempt;

    await sleep(delayMs);
  }

  throw new GoogleAdsApiError("Google Ads API request failed after retries", 429);
}

function buildGoogleAdsHeaders(opts: {
  accessToken: string;
  developerToken: string;
  loginCustomerId?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.accessToken}`,
    "developer-token": opts.developerToken,
    "Content-Type": "application/json",
  };

  if (opts.loginCustomerId) {
    headers["login-customer-id"] = normalizeGoogleAdsCustomerId(opts.loginCustomerId);
  }

  return headers;
}

export async function googleAdsSearchStream(opts: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  query: string;
  rateLimitOptions?: { maxRetries?: number; baseDelayMs?: number };
}): Promise<Array<Record<string, unknown>>> {
  const customerId = normalizeGoogleAdsCustomerId(opts.customerId);
  const headers = buildGoogleAdsHeaders(opts);

  const body = await fetchWithGoogleAdsRateLimitBackoff<GoogleAdsSearchStreamBatch[] | { error?: { message?: string } }>(
    () =>
      fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: opts.query }),
      }),
    opts.rateLimitOptions,
  );

  if (!Array.isArray(body)) {
    const message = body.error?.message ?? "Google Ads searchStream failed";
    throw new GoogleAdsApiError(message, 500);
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const batch of body) {
    if (batch.error?.message) {
      throw new GoogleAdsApiError(batch.error.message, 500);
    }
    if (batch.results) rows.push(...batch.results);
  }

  return rows;
}

export async function googleAdsSearchPaginated(opts: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  query: string;
  pageSize?: number;
  rateLimitOptions?: { maxRetries?: number; baseDelayMs?: number };
}): Promise<Array<Record<string, unknown>>> {
  const customerId = normalizeGoogleAdsCustomerId(opts.customerId);
  const headers = buildGoogleAdsHeaders(opts);
  const pageSize = opts.pageSize ?? 10_000;
  const rows: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;

  do {
    const body = await fetchWithGoogleAdsRateLimitBackoff<GoogleAdsSearchResponse>(
      () =>
        fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: opts.query,
            pageSize,
            pageToken,
          }),
        }),
      opts.rateLimitOptions,
    );

    if (body.results) rows.push(...body.results);
    pageToken = body.nextPageToken;
  } while (pageToken);

  return rows;
}

export async function listAccessibleGoogleAdsCustomers(opts: {
  accessToken: string;
  developerToken: string;
}): Promise<string[]> {
  const res = await fetch(`${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "developer-token": opts.developerToken,
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    resourceNames?: string[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new GoogleAdsApiError(
      body.error?.message ?? `Google Ads listAccessibleCustomers failed: ${res.status}`,
      res.status,
    );
  }

  return (body.resourceNames ?? []).map(normalizeGoogleAdsCustomerId);
}

export type GoogleAdsCustomerInfo = {
  customerId: string;
  descriptiveName: string;
  currencyCode: string | null;
  isManager: boolean;
};

export async function fetchGoogleAdsCustomerInfo(opts: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}): Promise<GoogleAdsCustomerInfo> {
  const rows = await googleAdsSearchStream({
    ...opts,
    query:
      "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code FROM customer LIMIT 1",
  });

  const row = rows[0];
  const customer = (row?.customer ?? {}) as Record<string, unknown>;

  return {
    customerId: normalizeGoogleAdsCustomerId(String(customer.id ?? opts.customerId)),
    descriptiveName: String(customer.descriptiveName ?? customer.descriptive_name ?? `Account ${opts.customerId}`),
    currencyCode:
      customer.currencyCode != null
        ? String(customer.currencyCode)
        : customer.currency_code != null
          ? String(customer.currency_code)
          : null,
    isManager: Boolean(customer.manager),
  };
}

export type GoogleAdsClientAccount = {
  customerId: string;
  descriptiveName: string;
  currencyCode: string | null;
  managerCustomerId: string;
};

export async function fetchGoogleAdsClientAccounts(opts: {
  accessToken: string;
  developerToken: string;
  managerCustomerId: string;
}): Promise<GoogleAdsClientAccount[]> {
  const rows = await googleAdsSearchStream({
    accessToken: opts.accessToken,
    developerToken: opts.developerToken,
    customerId: opts.managerCustomerId,
    loginCustomerId: opts.managerCustomerId,
    query:
      "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 1",
  });

  const clients: GoogleAdsClientAccount[] = [];

  for (const row of rows) {
    const client = (row.customerClient ?? row.customer_client ?? {}) as Record<string, unknown>;
    const clientCustomer = client.clientCustomer ?? client.client_customer;
    if (!clientCustomer) continue;

    const customerId = normalizeGoogleAdsCustomerId(String(clientCustomer));
    if (customerId === normalizeGoogleAdsCustomerId(opts.managerCustomerId)) continue;

    clients.push({
      customerId,
      descriptiveName: String(client.descriptiveName ?? client.descriptive_name ?? customerId),
      currencyCode:
        client.currencyCode != null
          ? String(client.currencyCode)
          : client.currency_code != null
            ? String(client.currency_code)
            : null,
      managerCustomerId: opts.managerCustomerId,
    });
  }

  return clients;
}
