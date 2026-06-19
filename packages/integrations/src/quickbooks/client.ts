import { getQuickBooksApiBaseUrl, type QuickBooksEnvironment } from "./oauth.js";

export class QuickBooksApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "QuickBooksApiError";
  }
}

export async function quickBooksApiFetch<T>(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
  path: string;
  query?: Record<string, string>;
}): Promise<T> {
  const baseUrl = getQuickBooksApiBaseUrl(opts.environment);
  const url = new URL(`${baseUrl}/v3/company/${opts.realmId}/${opts.path.replace(/^\//, "")}`);
  url.searchParams.set("minorversion", "73");
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: "application/json",
    },
  });

  const body = (await res.json().catch(() => ({}))) as T & {
    Fault?: { Error?: Array<{ Message?: string; Detail?: string }> };
  };

  if (!res.ok) {
    const message =
      body.Fault?.Error?.[0]?.Message ??
      body.Fault?.Error?.[0]?.Detail ??
      `QuickBooks API request failed: ${res.status}`;
    throw new QuickBooksApiError(message, res.status);
  }

  return body;
}

export async function quickBooksQuery<T>(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
  query: string;
}): Promise<T[]> {
  const response = await quickBooksApiFetch<Record<string, unknown>>({
    ...opts,
    path: "query",
    query: { query: opts.query },
  });

  const queryResponse = response.QueryResponse as Record<string, unknown> | undefined;
  if (!queryResponse) return [];

  for (const key of Object.keys(queryResponse)) {
    if (key === "startPosition" || key === "maxResults" || key === "totalCount") continue;
    const rows = queryResponse[key];
    if (Array.isArray(rows)) return rows as T[];
    if (rows && typeof rows === "object") return [rows as T];
  }

  return [];
}
