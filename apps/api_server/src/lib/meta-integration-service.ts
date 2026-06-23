import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  alerts,
  integrationCredentials,
  integrations,
  metaAdAccounts,
  metaIntegrationState,
  metaSyncJobs,
  type Database,
} from "@morgan/db";
import {
  decryptSecret,
  encryptSecret,
  exchangeMetaAuthorizationCode,
  exchangeForLongLivedToken,
  fetchMetaAdAccounts,
  META_TOKEN_EXPIRED_MESSAGE,
  refreshLongLivedToken,
  resolveMetaIntegrationErrorMessage,
  revokeMetaAccessToken,
  type MetaAdAccount,
} from "@morgan/integrations";

export type MetaCredentialPayload = {
  access_token: string;
  token_type?: string;
  expires_in?: number | null;
  scopes: string;
};

export type MetaIntegrationCard = {
  provider: "meta";
  status: "connected" | "syncing" | "error" | "disconnected";
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  error_message: string | null;
  sync_error_message: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  needs_account_selection: boolean;
  needs_reauth: boolean;
  insights_backfill_completed: boolean;
};

function tokenExpiresAt(expiresIn?: number | null): Date | null {
  if (!expiresIn || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function upsertMetaIntegration(
  db: Database,
  storeId: string,
  scopes: string,
): Promise<{ integrationId: string }> {
  const [existing] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
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
      provider: "meta",
      status: "syncing",
      scopes,
    })
    .returning({ id: integrations.id });

  return { integrationId: created.id };
}

async function saveMetaCredentials(
  db: Database,
  integrationId: string,
  payload: MetaCredentialPayload,
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

async function ensureMetaStateRow(db: Database, integrationId: string) {
  await db
    .insert(metaIntegrationState)
    .values({
      integrationId,
      pendingAccountSelection: false,
      refreshFailureCount: 0,
      lastError: null,
    })
    .onConflictDoNothing();
}

async function replaceDiscoveredAdAccounts(
  db: Database,
  integrationId: string,
  accounts: MetaAdAccount[],
): Promise<void> {
  await db.delete(metaAdAccounts).where(eq(metaAdAccounts.integrationId, integrationId));

  if (accounts.length === 0) return;

  await db.insert(metaAdAccounts).values(
    accounts.map((account) => ({
      integrationId,
      externalId: account.id,
      name: account.name,
      currency: account.currency ?? null,
      accountStatus: account.account_status ?? null,
      isSelected: false,
    })),
  );
}

async function enqueueMetaSyncJob(db: Database, storeId: string, integrationId: string) {
  await db.insert(metaSyncJobs).values({
    storeId,
    integrationId,
    status: "pending",
  });
}

async function cancelActiveMetaSyncJobs(db: Database, integrationId: string) {
  await db
    .update(metaSyncJobs)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(metaSyncJobs.integrationId, integrationId),
        inArray(metaSyncJobs.status, ["pending", "running"]),
      ),
    );
}

export async function getMetaCredentials(
  db: Database,
  integrationId: string,
  encryptionKey: string,
): Promise<MetaCredentialPayload | null> {
  const [cred] = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (!cred) return null;

  return JSON.parse(decryptSecret(cred.encryptedPayload, encryptionKey)) as MetaCredentialPayload;
}

export async function getMetaIntegrationForStore(
  db: Database,
  storeId: string,
): Promise<MetaIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  if (!integration) {
    return {
      provider: "meta",
      status: "disconnected",
      last_sync_at: null,
      last_successful_sync_at: null,
      error_message: null,
      sync_error_message: null,
      ad_account_id: null,
      ad_account_name: null,
      needs_account_selection: false,
      needs_reauth: false,
      insights_backfill_completed: false,
    };
  }

  const [state] = await db
    .select()
    .from(metaIntegrationState)
    .where(eq(metaIntegrationState.integrationId, integration.id))
    .limit(1);

  const [selectedAccount] = await db
    .select()
    .from(metaAdAccounts)
    .where(
      and(eq(metaAdAccounts.integrationId, integration.id), eq(metaAdAccounts.isSelected, true)),
    )
    .limit(1);

  const refreshFailureCount = state?.refreshFailureCount ?? 0;
  const { needsReauth, errorMessage } = resolveMetaIntegrationErrorMessage({
    status: integration.status,
    refreshFailureCount,
    lastError: state?.lastError ?? null,
  });

  return {
    provider: "meta",
    status: needsReauth ? "error" : integration.status,
    last_sync_at: integration.lastSyncAt?.toISOString() ?? null,
    last_successful_sync_at: integration.lastSyncAt?.toISOString() ?? null,
    error_message: errorMessage,
    sync_error_message: state?.lastInsightsError ?? null,
    ad_account_id: selectedAccount?.externalId ?? null,
    ad_account_name: selectedAccount?.name ?? null,
    needs_account_selection: state?.pendingAccountSelection ?? false,
    needs_reauth: needsReauth,
    insights_backfill_completed: state?.insightsBackfillCompleted ?? false,
  };
}

async function getSelectedMetaAdAccountExternalId(
  db: Database,
  integrationId: string,
): Promise<string | null> {
  const [account] = await db
    .select({ externalId: metaAdAccounts.externalId })
    .from(metaAdAccounts)
    .where(and(eq(metaAdAccounts.integrationId, integrationId), eq(metaAdAccounts.isSelected, true)))
    .limit(1);

  return account?.externalId ?? null;
}

export async function completeMetaOAuth(
  db: Database,
  input: {
    storeId: string;
    appId: string;
    appSecret: string;
    redirectUri: string;
    code: string;
    scopes: string;
    encryptionKey: string;
  },
): Promise<{ needsAccountSelection: boolean; accountCount: number; reconnected: boolean }> {
  const [existingIntegration] = await db
    .select({ id: integrations.id, status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, input.storeId), eq(integrations.provider, "meta")))
    .limit(1);

  const previousSelectedAccountId = existingIntegration
    ? await getSelectedMetaAdAccountExternalId(db, existingIntegration.id)
    : null;
  const isReconnect = Boolean(
    existingIntegration && existingIntegration.status !== "disconnected",
  );

  const shortToken = await exchangeMetaAuthorizationCode({
    appId: input.appId,
    appSecret: input.appSecret,
    redirectUri: input.redirectUri,
    code: input.code,
  });

  const longToken = await exchangeForLongLivedToken({
    appId: input.appId,
    appSecret: input.appSecret,
    shortLivedToken: shortToken.access_token,
  });

  const adAccounts = await fetchMetaAdAccounts(longToken.access_token);
  if (adAccounts.length === 0) {
    throw new Error("no_ad_accounts");
  }

  const { integrationId } = await upsertMetaIntegration(db, input.storeId, input.scopes);
  await ensureMetaStateRow(db, integrationId);

  await saveMetaCredentials(
    db,
    integrationId,
    {
      access_token: longToken.access_token,
      token_type: longToken.token_type,
      expires_in: longToken.expires_in ?? null,
      scopes: input.scopes,
    },
    input.encryptionKey,
  );

  await replaceDiscoveredAdAccounts(db, integrationId, adAccounts);

  const restoredAccountId =
    isReconnect &&
    previousSelectedAccountId &&
    adAccounts.some((account) => account.id === previousSelectedAccountId)
      ? previousSelectedAccountId
      : null;

  if (restoredAccountId) {
    await selectMetaAdAccount(db, input.storeId, restoredAccountId);
    return { needsAccountSelection: false, accountCount: adAccounts.length, reconnected: true };
  }

  const needsAccountSelection = adAccounts.length > 1;

  if (needsAccountSelection) {
    await db
      .update(metaIntegrationState)
      .set({
        pendingAccountSelection: true,
        refreshFailureCount: 0,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(metaIntegrationState.integrationId, integrationId));

    await db
      .update(integrations)
      .set({ status: "syncing" })
      .where(eq(integrations.id, integrationId));

    return { needsAccountSelection: true, accountCount: adAccounts.length, reconnected: isReconnect };
  }

  await selectMetaAdAccount(db, input.storeId, adAccounts[0]!.id);
  return { needsAccountSelection: false, accountCount: adAccounts.length, reconnected: isReconnect };
}

export async function listMetaAdAccounts(db: Database, storeId: string) {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  if (!integration) {
    return [];
  }

  return db
    .select({
      id: metaAdAccounts.externalId,
      name: metaAdAccounts.name,
      currency: metaAdAccounts.currency,
      account_status: metaAdAccounts.accountStatus,
      is_selected: metaAdAccounts.isSelected,
    })
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.integrationId, integration.id))
    .orderBy(desc(metaAdAccounts.name));
}

export async function selectMetaAdAccount(
  db: Database,
  storeId: string,
  adAccountExternalId: string,
): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  if (!integration) {
    throw new Error("meta_not_connected");
  }

  const [account] = await db
    .select()
    .from(metaAdAccounts)
    .where(
      and(
        eq(metaAdAccounts.integrationId, integration.id),
        eq(metaAdAccounts.externalId, adAccountExternalId),
      ),
    )
    .limit(1);

  if (!account) {
    throw new Error("invalid_ad_account");
  }

  await db
    .update(metaAdAccounts)
    .set({ isSelected: false })
    .where(eq(metaAdAccounts.integrationId, integration.id));

  await db
    .update(metaAdAccounts)
    .set({ isSelected: true })
    .where(eq(metaAdAccounts.id, account.id));

  await db
    .update(metaIntegrationState)
    .set({
      pendingAccountSelection: false,
      refreshFailureCount: 0,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(metaIntegrationState.integrationId, integration.id));

  await db
    .update(integrations)
    .set({ status: "syncing", connectedAt: new Date() })
    .where(eq(integrations.id, integration.id));

  await enqueueMetaSyncJob(db, storeId, integration.id);
}

export async function disconnectMetaIntegration(
  db: Database,
  storeId: string,
  encryptionKey: string,
  appId: string,
): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  if (!integration) return;

  const credentials = await getMetaCredentials(db, integration.id, encryptionKey);
  if (credentials?.access_token) {
    try {
      await revokeMetaAccessToken(credentials.access_token);
    } catch {
      // Revoke is best-effort; local disconnect still proceeds.
    }
  }

  await cancelActiveMetaSyncJobs(db, integration.id);

  await db
    .update(integrations)
    .set({ status: "disconnected", lastSyncAt: integration.lastSyncAt })
    .where(eq(integrations.id, integration.id));

  await db
    .update(metaIntegrationState)
    .set({
      pendingAccountSelection: false,
      refreshFailureCount: 0,
      lastError: null,
      lastInsightsError: null,
      insightsBackfillCompleted: false,
      updatedAt: new Date(),
    })
    .where(eq(metaIntegrationState.integrationId, integration.id));

  await db
    .update(metaAdAccounts)
    .set({ isSelected: false })
    .where(eq(metaAdAccounts.integrationId, integration.id));

  await db.delete(integrationCredentials).where(eq(integrationCredentials.integrationId, integration.id));
}

export async function refreshMetaTokens(
  db: Database,
  input: {
    encryptionKey: string;
    appId: string;
    appSecret: string;
    refreshWithinMs: number;
  },
): Promise<void> {
  const rows = await db
    .select({
      integration: integrations,
      credential: integrationCredentials,
      state: metaIntegrationState,
    })
    .from(integrations)
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .leftJoin(metaIntegrationState, eq(metaIntegrationState.integrationId, integrations.id))
    .where(
      and(
        eq(integrations.provider, "meta"),
        or(eq(integrations.status, "connected"), eq(integrations.status, "syncing")),
      ),
    );

  const refreshCutoff = new Date(Date.now() + input.refreshWithinMs);

  for (const row of rows) {
    const state = row.state;
    if (state?.pendingAccountSelection) continue;

    const expiresAt = row.credential.expiresAt;
    if (expiresAt && expiresAt > refreshCutoff) continue;

    let payload: MetaCredentialPayload;
    try {
      payload = JSON.parse(
        decryptSecret(row.credential.encryptedPayload, input.encryptionKey),
      ) as MetaCredentialPayload;
    } catch {
      await recordMetaRefreshFailure(db, row.integration.id, row.integration.storeId, "Could not decrypt Meta credentials");
      continue;
    }

    try {
      const refreshed = await refreshLongLivedToken({
        appId: input.appId,
        appSecret: input.appSecret,
        accessToken: payload.access_token,
      });

      await saveMetaCredentials(
        db,
        row.integration.id,
        {
          ...payload,
          access_token: refreshed.access_token,
          expires_in: refreshed.expires_in ?? payload.expires_in ?? null,
        },
        input.encryptionKey,
      );

      await db
        .update(metaIntegrationState)
        .set({
          refreshFailureCount: 0,
          lastTokenRefreshAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(metaIntegrationState.integrationId, row.integration.id));

      if (row.integration.status === "error") {
        await db
          .update(integrations)
          .set({ status: "connected" })
          .where(eq(integrations.id, row.integration.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta token refresh failed";
      await recordMetaRefreshFailure(db, row.integration.id, row.integration.storeId, message);
    }
  }
}

async function recordMetaRefreshFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  const [state] = await db
    .select()
    .from(metaIntegrationState)
    .where(eq(metaIntegrationState.integrationId, integrationId))
    .limit(1);

  const failureCount = (state?.refreshFailureCount ?? 0) + 1;
  const errorMessage = failureCount >= 2 ? META_TOKEN_EXPIRED_MESSAGE : message;

  await db
    .insert(metaIntegrationState)
    .values({
      integrationId,
      refreshFailureCount: failureCount,
      lastError: errorMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: metaIntegrationState.integrationId,
      set: {
        refreshFailureCount: failureCount,
        lastError: errorMessage,
        updatedAt: new Date(),
      },
    });

  if (failureCount >= 2) {
    await db
      .update(integrations)
      .set({ status: "error" })
      .where(eq(integrations.id, integrationId));

    await db
      .insert(alerts)
      .values({
        storeId,
        severity: "warning",
        type: "meta_token_expired",
        title: "Meta Ads connection needs attention",
        body: `${META_TOKEN_EXPIRED_MESSAGE}. Reconnect Meta Ads in Integrations to resume ad sync.`,
        dedupeKey: "meta_token_refresh_failed",
      })
      .onConflictDoNothing();
  }
}
