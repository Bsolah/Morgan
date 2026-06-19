import { META_GRAPH_VERSION } from "./oauth.js";

export type MetaAdAccount = {
  id: string;
  name: string;
  currency?: string;
  account_status?: number;
};

type MetaGraphListResponse<T> = {
  data?: T[];
  error?: { message?: string; code?: number };
};

export async function fetchMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({
    fields: "id,name,account_status,currency",
    access_token: accessToken,
    limit: "200",
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts?${params}`,
  );

  const body = (await res.json().catch(() => ({}))) as MetaGraphListResponse<MetaAdAccount>;

  if (!res.ok) {
    throw new Error(body.error?.message ?? `Meta ad accounts request failed: ${res.status}`);
  }

  return body.data ?? [];
}

export async function revokeMetaAccessToken(accessToken: string): Promise<void> {
  const params = new URLSearchParams({ access_token: accessToken });
  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions?${params}`,
    { method: "DELETE" },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Meta token revoke failed: ${res.status}`);
  }
}
