import { and, desc, eq, inArray } from "drizzle-orm";
import {
  googleAdsCustomers,
  googleAdsIntegrationState,
  googleAdsSyncJobs,
  integrationCredentials,
  integrations,
  type Database,
} from "@morgan/db";
import {
  decryptSecret,
  encryptSecret,
  exchangeGoogleAuthorizationCode,
  fetchGoogleAdsClientAccounts,
  fetchGoogleAdsCustomerInfo,
  GOOGLE_ADS_SCOPE,
  listAccessibleGoogleAdsCustomers,
  refreshGoogleAccessToken,
  revokeGoogleToken,
} from "@morgan/integrations";

export type GoogleAdsCredentialPayload = {
  access_token: string;
  refresh_token: string;
  expires_in?: number | null;
  token_type?: string;
  scopes: string;
};

export type GoogleAdsIntegrationCard = {
  provider: "google_ads";
  availability: "available";
  status: "connected" | "syncing" | "error" | "disconnected";
  last_sync_at: string | null;
  error_message: string | null;
  sync_error_message: string | null;
  manager_customer_id: string | null;
  manager_customer_name: string | null;
  client_customer_id: string | null;
  client_customer_name: string | null;
  needs_manager_selection: boolean;
  needs_client_selection: boolean;
  insights_backfill_completed: boolean;
};

function tokenExpiresAt(expiresIn?: number | null): Date | null {
  if (!expiresIn || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function upsertGoogleAdsIntegration(
  db: Database,
  storeId: string,
  scopes: string,
): Promise<{ integrationId: string }> {
  const [existing] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(integrations)
      .set({
        status: "syncing",
        scopes,
        connectedAt: new Date(),
        lastSyncAt: null,
      })
      .where(eq(integrations.id, existing.id))
      .returning({ id: integrations.id });

    return { integrationId: updated.id };
  }

  const [created] = await db
    .insert(integrations)
    .values({
      storeId,
      provider: "google_ads",
      status: "syncing",
      scopes,
    })
    .returning({ id: integrations.id });

  return { integrationId: created.id };
}

async function saveGoogleAdsCredentials(
  db: Database,
  integrationId: string,
  payload: GoogleAdsCredentialPayload,
  encryptionKey: string,
): Promise<void> {
  const encryptedPayload = encryptSecret(JSON.stringify(payload), encryptionKey);
  const expiresAt = tokenExpiresAt(payload.expires_in ?? null);

  const [existingCred] = await db
    .select({ id: integrationCredentials.id })
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (existingCred) {
    await db
      .update(integrationCredentials)
      .set({ encryptedPayload, expiresAt })
      .where(eq(integrationCredentials.id, existingCred.id));
    return;
  }

  await db.insert(integrationCredentials).values({
    integrationId,
    encryptedPayload,
    expiresAt,
  });
}

async function ensureGoogleAdsStateRow(db: Database, integrationId: string) {
  await db.insert(googleAdsIntegrationState).values({ integrationId }).onConflictDoNothing();
}

async function replaceDiscoveredCustomers(
  db: Database,
  integrationId: string,
  customers: Array<{
    customerId: string;
    descriptiveName: string;
    currencyCode: string | null;
    isManager: boolean;
    managerCustomerId?: string | null;
  }>,
) {
  await db.delete(googleAdsCustomers).where(eq(googleAdsCustomers.integrationId, integrationId));
  if (customers.length === 0) return;

  await db.insert(googleAdsCustomers).values(
    customers.map((customer) => ({
      integrationId,
      customerId: customer.customerId,
      descriptiveName: customer.descriptiveName,
      currencyCode: customer.currencyCode,
      isManager: customer.isManager,
      managerCustomerId: customer.managerCustomerId ?? null,
      isSelectedManager: false,
      isSelectedClient: false,
    })),
  );
}

async function enqueueGoogleAdsSyncJob(db: Database, storeId: string, integrationId: string) {
  await db.insert(googleAdsSyncJobs).values({
    storeId,
    integrationId,
    status: "pending",
  });
}

export async function getGoogleAdsCredentials(
  db: Database,
  integrationId: string,
  encryptionKey: string,
): Promise<GoogleAdsCredentialPayload | null> {
  const [cred] = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (!cred) return null;

  return JSON.parse(decryptSecret(cred.encryptedPayload, encryptionKey)) as GoogleAdsCredentialPayload;
}

export async function getGoogleAdsIntegrationForStore(
  db: Database,
  storeId: string,
): Promise<GoogleAdsIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) {
    return {
      provider: "google_ads",
      availability: "available",
      status: "disconnected",
      last_sync_at: null,
      error_message: null,
      sync_error_message: null,
      manager_customer_id: null,
      manager_customer_name: null,
      client_customer_id: null,
      client_customer_name: null,
      needs_manager_selection: false,
      needs_client_selection: false,
      insights_backfill_completed: false,
    };
  }

  const [state] = await db
    .select()
    .from(googleAdsIntegrationState)
    .where(eq(googleAdsIntegrationState.integrationId, integration.id))
    .limit(1);

  const customers = await db
    .select()
    .from(googleAdsCustomers)
    .where(eq(googleAdsCustomers.integrationId, integration.id));

  const selectedManager = customers.find((row) => row.isSelectedManager);
  const selectedClient = customers.find((row) => row.isSelectedClient);

  return {
    provider: "google_ads",
    availability: "available",
    status: integration.status,
    last_sync_at: integration.lastSyncAt?.toISOString() ?? null,
    error_message: state?.lastError ?? null,
    sync_error_message: state?.lastInsightsError ?? null,
    manager_customer_id: selectedManager?.customerId ?? state?.selectedManagerCustomerId ?? null,
    manager_customer_name: selectedManager?.descriptiveName ?? null,
    client_customer_id: selectedClient?.customerId ?? state?.selectedClientCustomerId ?? null,
    client_customer_name: selectedClient?.descriptiveName ?? null,
    needs_manager_selection: state?.pendingManagerSelection ?? false,
    needs_client_selection: state?.pendingClientSelection ?? false,
    insights_backfill_completed: state?.insightsBackfillCompleted ?? false,
  };
}

async function discoverAccessibleCustomers(
  accessToken: string,
  developerToken: string,
) {
  const customerIds = await listAccessibleGoogleAdsCustomers({ accessToken, developerToken });
  const discovered = [];

  for (const customerId of customerIds) {
    const info = await fetchGoogleAdsCustomerInfo({
      accessToken,
      developerToken,
      customerId,
      loginCustomerId: customerId,
    });
    discovered.push(info);
  }

  return discovered;
}

async function finalizeClientSelection(
  db: Database,
  storeId: string,
  integrationId: string,
  clientCustomerId: string,
) {
  await db
    .update(googleAdsCustomers)
    .set({ isSelectedClient: false })
    .where(eq(googleAdsCustomers.integrationId, integrationId));

  await db
    .update(googleAdsCustomers)
    .set({ isSelectedClient: true })
    .where(
      and(
        eq(googleAdsCustomers.integrationId, integrationId),
        eq(googleAdsCustomers.customerId, clientCustomerId),
      ),
    );

  await db
    .update(googleAdsIntegrationState)
    .set({
      pendingClientSelection: false,
      pendingManagerSelection: false,
      selectedClientCustomerId: clientCustomerId,
      refreshFailureCount: 0,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(googleAdsIntegrationState.integrationId, integrationId));

  await db
    .update(integrations)
    .set({ status: "syncing", connectedAt: new Date() })
    .where(eq(integrations.id, integrationId));

  await enqueueGoogleAdsSyncJob(db, storeId, integrationId);
}

export async function completeGoogleAdsOAuth(
  db: Database,
  input: {
    storeId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
    developerToken: string;
    encryptionKey: string;
  },
): Promise<{ needsManagerSelection: boolean; needsClientSelection: boolean }> {
  const tokens = await exchangeGoogleAuthorizationCode({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    code: input.code,
  });

  if (!tokens.refresh_token) {
    throw new Error("missing_refresh_token");
  }

  const discovered = await discoverAccessibleCustomers(tokens.access_token, input.developerToken);
  if (discovered.length === 0) {
    throw new Error("no_accounts");
  }

  const { integrationId } = await upsertGoogleAdsIntegration(db, input.storeId, GOOGLE_ADS_SCOPE);
  await ensureGoogleAdsStateRow(db, integrationId);

  await saveGoogleAdsCredentials(
    db,
    integrationId,
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in ?? null,
      scopes: GOOGLE_ADS_SCOPE,
    },
    input.encryptionKey,
  );

  await replaceDiscoveredCustomers(
    db,
    integrationId,
    discovered.map((account) => ({
      customerId: account.customerId,
      descriptiveName: account.descriptiveName,
      currencyCode: account.currencyCode,
      isManager: account.isManager,
    })),
  );

  const managers = discovered.filter((account) => account.isManager);
  const standaloneClients = discovered.filter((account) => !account.isManager);

  if (managers.length > 1) {
    await db
      .update(googleAdsIntegrationState)
      .set({
        pendingManagerSelection: true,
        pendingClientSelection: false,
        updatedAt: new Date(),
      })
      .where(eq(googleAdsIntegrationState.integrationId, integrationId));
    return { needsManagerSelection: true, needsClientSelection: false };
  }

  if (managers.length === 1) {
    return selectGoogleAdsManagerAccount(db, input.storeId, managers[0]!.customerId, {
      accessToken: tokens.access_token,
      developerToken: input.developerToken,
    });
  }

  if (standaloneClients.length === 1) {
    await finalizeClientSelection(db, input.storeId, integrationId, standaloneClients[0]!.customerId);
    return { needsManagerSelection: false, needsClientSelection: false };
  }

  await db
    .update(googleAdsIntegrationState)
    .set({
      pendingManagerSelection: false,
      pendingClientSelection: true,
      updatedAt: new Date(),
    })
    .where(eq(googleAdsIntegrationState.integrationId, integrationId));

  return { needsManagerSelection: false, needsClientSelection: true };
}

export async function listGoogleAdsManagerAccounts(db: Database, storeId: string) {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) return [];

  return db
    .select({
      id: googleAdsCustomers.customerId,
      name: googleAdsCustomers.descriptiveName,
      currency: googleAdsCustomers.currencyCode,
      is_selected: googleAdsCustomers.isSelectedManager,
    })
    .from(googleAdsCustomers)
    .where(
      and(
        eq(googleAdsCustomers.integrationId, integration.id),
        eq(googleAdsCustomers.isManager, true),
      ),
    )
    .orderBy(desc(googleAdsCustomers.descriptiveName));
}

export async function listGoogleAdsClientAccounts(db: Database, storeId: string) {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) return [];

  const [state] = await db
    .select({ managerCustomerId: googleAdsIntegrationState.selectedManagerCustomerId })
    .from(googleAdsIntegrationState)
    .where(eq(googleAdsIntegrationState.integrationId, integration.id))
    .limit(1);

  const rows = await db
    .select()
    .from(googleAdsCustomers)
    .where(eq(googleAdsCustomers.integrationId, integration.id));

  const managerId = state?.managerCustomerId;
  const clients = rows.filter((row) => {
    if (row.isSelectedClient) return true;
    if (managerId) {
      return row.managerCustomerId === managerId || (!row.isManager && row.customerId !== managerId);
    }
    return !row.isManager;
  });

  return clients.map((row) => ({
    id: row.customerId,
    name: row.descriptiveName,
    currency: row.currencyCode,
    manager_customer_id: row.managerCustomerId,
    is_selected: row.isSelectedClient,
  }));
}

export async function selectGoogleAdsManagerAccount(
  db: Database,
  storeId: string,
  managerCustomerId: string,
  api?: { accessToken: string; developerToken: string },
): Promise<{ needsManagerSelection: boolean; needsClientSelection: boolean }> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) throw new Error("google_ads_not_connected");

  const [manager] = await db
    .select()
    .from(googleAdsCustomers)
    .where(
      and(
        eq(googleAdsCustomers.integrationId, integration.id),
        eq(googleAdsCustomers.customerId, managerCustomerId),
        eq(googleAdsCustomers.isManager, true),
      ),
    )
    .limit(1);

  if (!manager) throw new Error("invalid_manager_account");

  await db
    .update(googleAdsCustomers)
    .set({ isSelectedManager: false })
    .where(eq(googleAdsCustomers.integrationId, integration.id));

  await db
    .update(googleAdsCustomers)
    .set({ isSelectedManager: true })
    .where(eq(googleAdsCustomers.id, manager.id));

  await db
    .update(googleAdsIntegrationState)
    .set({
      pendingManagerSelection: false,
      selectedManagerCustomerId: managerCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(googleAdsIntegrationState.integrationId, integration.id));

  let clientAccounts: Array<{
    customerId: string;
    descriptiveName: string;
    currencyCode: string | null;
    managerCustomerId: string;
  }> = [];

  if (api) {
    clientAccounts = await fetchGoogleAdsClientAccounts({
      accessToken: api.accessToken,
      developerToken: api.developerToken,
      managerCustomerId,
    });
  }

  if (clientAccounts.length > 0) {
    for (const client of clientAccounts) {
      await db
        .insert(googleAdsCustomers)
        .values({
          integrationId: integration.id,
          customerId: client.customerId,
          descriptiveName: client.descriptiveName,
          currencyCode: client.currencyCode,
          isManager: false,
          managerCustomerId: client.managerCustomerId,
        })
        .onConflictDoUpdate({
          target: [googleAdsCustomers.integrationId, googleAdsCustomers.customerId],
          set: {
            descriptiveName: client.descriptiveName,
            currencyCode: client.currencyCode,
            managerCustomerId: client.managerCustomerId,
          },
        });
    }
  }

  const selectableClients =
    clientAccounts.length > 0
      ? clientAccounts
      : [{ customerId: managerCustomerId, descriptiveName: manager.descriptiveName, currencyCode: manager.currencyCode, managerCustomerId }];

  if (selectableClients.length === 1) {
    await finalizeClientSelection(db, storeId, integration.id, selectableClients[0]!.customerId);
    return { needsManagerSelection: false, needsClientSelection: false };
  }

  await db
    .update(googleAdsIntegrationState)
    .set({
      pendingClientSelection: true,
      updatedAt: new Date(),
    })
    .where(eq(googleAdsIntegrationState.integrationId, integration.id));

  return { needsManagerSelection: false, needsClientSelection: true };
}

export async function selectGoogleAdsClientAccount(
  db: Database,
  storeId: string,
  clientCustomerId: string,
): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) throw new Error("google_ads_not_connected");

  const [client] = await db
    .select()
    .from(googleAdsCustomers)
    .where(
      and(
        eq(googleAdsCustomers.integrationId, integration.id),
        eq(googleAdsCustomers.customerId, clientCustomerId),
      ),
    )
    .limit(1);

  if (!client) throw new Error("invalid_client_account");

  await finalizeClientSelection(db, storeId, integration.id, clientCustomerId);
}

export async function getSelectedGoogleAdsClientCustomerId(
  db: Database,
  storeId: string,
): Promise<{ clientCustomerId: string; managerCustomerId: string | null } | null> {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) return null;

  const [state] = await db
    .select()
    .from(googleAdsIntegrationState)
    .where(eq(googleAdsIntegrationState.integrationId, integration.id))
    .limit(1);

  const clientCustomerId = state?.selectedClientCustomerId;
  if (!clientCustomerId) return null;

  return {
    clientCustomerId,
    managerCustomerId: state?.selectedManagerCustomerId ?? null,
  };
}

export async function disconnectGoogleAdsIntegration(
  db: Database,
  storeId: string,
  input: {
    clientId: string;
    clientSecret: string;
    encryptionKey: string;
  },
): Promise<GoogleAdsIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration) {
    return getGoogleAdsIntegrationForStore(db, storeId);
  }

  const credentials = await getGoogleAdsCredentials(db, integration.id, input.encryptionKey);
  if (credentials?.refresh_token) {
    try {
      await revokeGoogleToken(credentials.refresh_token);
    } catch {
      // Best-effort revoke.
    }
  }

  await db
    .update(googleAdsSyncJobs)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(googleAdsSyncJobs.integrationId, integration.id),
        inArray(googleAdsSyncJobs.status, ["pending", "running"]),
      ),
    );

  await db.delete(googleAdsCustomers).where(eq(googleAdsCustomers.integrationId, integration.id));
  await db
    .delete(googleAdsIntegrationState)
    .where(eq(googleAdsIntegrationState.integrationId, integration.id));
  await db
    .delete(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integration.id));
  await db
    .update(integrations)
    .set({ status: "disconnected" })
    .where(eq(integrations.id, integration.id));

  return getGoogleAdsIntegrationForStore(db, storeId);
}

export async function refreshGoogleAdsTokens(
  db: Database,
  input: {
    encryptionKey: string;
    clientId: string;
    clientSecret: string;
    refreshWithinMs: number;
  },
): Promise<void> {
  const rows = await db
    .select({
      integration: integrations,
      credential: integrationCredentials,
    })
    .from(integrations)
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .where(
      and(
        eq(integrations.provider, "google_ads"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  const refreshCutoff = new Date(Date.now() + input.refreshWithinMs);

  for (const row of rows) {
    const expiresAt = row.credential.expiresAt;
    if (expiresAt && expiresAt > refreshCutoff) continue;

    let payload: GoogleAdsCredentialPayload;
    try {
      payload = JSON.parse(
        decryptSecret(row.credential.encryptedPayload, input.encryptionKey),
      ) as GoogleAdsCredentialPayload;
    } catch {
      continue;
    }

    try {
      const refreshed = await refreshGoogleAccessToken({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        refreshToken: payload.refresh_token,
      });

      await saveGoogleAdsCredentials(
        db,
        row.integration.id,
        {
          ...payload,
          access_token: refreshed.access_token,
          expires_in: refreshed.expires_in ?? payload.expires_in ?? null,
          refresh_token: refreshed.refresh_token ?? payload.refresh_token,
        },
        input.encryptionKey,
      );
    } catch {
      await db
        .update(integrations)
        .set({ status: "error" })
        .where(eq(integrations.id, row.integration.id));
    }
  }
}
