export type PlaidEnvironment = "sandbox" | "development" | "production";

export const PLAID_PRIVACY_DISCLOSURE =
  "We read transactions to forecast cash, never move money";

export const PLAID_SUPPORTED_ACCOUNT_SUBTYPES = ["checking", "savings"] as const;

export type PlaidLinkTokenResponse = {
  link_token: string;
  expiration: string;
  request_id: string;
};

export type PlaidExchangeTokenResponse = {
  access_token: string;
  item_id: string;
  request_id: string;
};

export type PlaidAccount = {
  account_id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
};

export type PlaidAccountsResponse = {
  accounts: PlaidAccount[];
  item: { institution_id: string | null };
  institution: { name: string | null; institution_id: string | null } | null;
};

export class PlaidApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "PlaidApiError";
  }
}

export function getPlaidBaseUrl(environment: PlaidEnvironment): string {
  return {
    sandbox: "https://sandbox.plaid.com",
    development: "https://development.plaid.com",
    production: "https://production.plaid.com",
  }[environment];
}

export async function plaidRequest<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as T & {
    error_message?: string;
    error_code?: string;
  };

  if (!res.ok) {
    throw new PlaidApiError(
      payload.error_message ?? `Plaid request failed: ${res.status}`,
      res.status,
      payload.error_code,
    );
  }

  return payload;
}

export async function createPlaidLinkToken(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  clientUserId: string;
  clientName?: string;
  redirectUri?: string;
}): Promise<PlaidLinkTokenResponse> {
  const baseUrl = getPlaidBaseUrl(opts.environment);

  return plaidRequest<PlaidLinkTokenResponse>(baseUrl, "/link/token/create", {
    client_id: opts.clientId,
    secret: opts.secret,
    client_name: opts.clientName ?? "Morgan",
    language: "en",
    country_codes: ["US"],
    user: { client_user_id: opts.clientUserId },
    products: ["transactions"],
    account_filters: {
      depository: {
        account_subtypes: PLAID_SUPPORTED_ACCOUNT_SUBTYPES,
      },
    },
    ...(opts.redirectUri ? { redirect_uri: opts.redirectUri } : {}),
  });
}

export async function exchangePlaidPublicToken(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  publicToken: string;
}): Promise<PlaidExchangeTokenResponse> {
  const baseUrl = getPlaidBaseUrl(opts.environment);

  return plaidRequest<PlaidExchangeTokenResponse>(baseUrl, "/item/public_token/exchange", {
    client_id: opts.clientId,
    secret: opts.secret,
    public_token: opts.publicToken,
  });
}

export async function fetchPlaidAccounts(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  accessToken: string;
}): Promise<PlaidAccountsResponse> {
  const baseUrl = getPlaidBaseUrl(opts.environment);

  const accountsPayload = await plaidRequest<{
    accounts: PlaidAccount[];
    item: { institution_id: string | null };
  }>(baseUrl, "/accounts/get", {
    client_id: opts.clientId,
    secret: opts.secret,
    access_token: opts.accessToken,
  });

  let institution: PlaidAccountsResponse["institution"] = null;
  if (accountsPayload.item.institution_id) {
    try {
      const institutionPayload = await plaidRequest<{
        institution: { name: string; institution_id: string };
      }>(baseUrl, "/institutions/get_by_id", {
        client_id: opts.clientId,
        secret: opts.secret,
        institution_id: accountsPayload.item.institution_id,
        country_codes: ["US"],
      });
      institution = institutionPayload.institution;
    } catch {
      institution = {
        name: null,
        institution_id: accountsPayload.item.institution_id,
      };
    }
  }

  return {
    accounts: accountsPayload.accounts,
    item: accountsPayload.item,
    institution,
  };
}

export async function removePlaidItem(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  accessToken: string;
}): Promise<void> {
  const baseUrl = getPlaidBaseUrl(opts.environment);

  await plaidRequest(baseUrl, "/item/remove", {
    client_id: opts.clientId,
    secret: opts.secret,
    access_token: opts.accessToken,
  });
}

export function pickPreferredBusinessAccount(accounts: PlaidAccount[]): PlaidAccount | null {
  const eligible = accounts.filter(
    (account) =>
      account.type === "depository" &&
      account.subtype != null &&
      PLAID_SUPPORTED_ACCOUNT_SUBTYPES.includes(
        account.subtype as (typeof PLAID_SUPPORTED_ACCOUNT_SUBTYPES)[number],
      ),
  );

  if (eligible.length === 0) return null;

  const checking = eligible.find((account) => account.subtype === "checking");
  return checking ?? eligible[0]!;
}
