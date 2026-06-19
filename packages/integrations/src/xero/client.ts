export class XeroApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "XeroApiError";
  }
}

export async function xeroApiFetch<T>(opts: {
  accessToken: string;
  tenantId: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): Promise<T> {
  const url = new URL(`https://api.xero.com/api.xro/2.0/${opts.path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "xero-tenant-id": opts.tenantId,
      Accept: "application/json",
      ...opts.headers,
    },
  });

  const body = (await res.json().catch(() => ({}))) as T & {
    Message?: string;
    Detail?: string;
    Elements?: unknown[];
  };

  if (!res.ok) {
    const message = body.Message ?? body.Detail ?? `Xero API request failed: ${res.status}`;
    throw new XeroApiError(message, res.status);
  }

  return body;
}

export async function xeroApiList<T>(opts: {
  accessToken: string;
  tenantId: string;
  path: string;
  collectionKey: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): Promise<T[]> {
  const body = await xeroApiFetch<Record<string, unknown>>(opts);
  const rows = body[opts.collectionKey];
  if (Array.isArray(rows)) return rows as T[];
  if (rows && typeof rows === "object") return [rows as T];
  return [];
}
