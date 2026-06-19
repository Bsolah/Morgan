import { and, eq, inArray } from "drizzle-orm";
import {
  alerts,
  integrationCredentials,
  integrations,
  quickbooksCompanies,
  quickbooksIntegrationState,
  type Database,
} from "@morgan/db";
import {
  QUICKBOOKS_ACCOUNTING_SCOPE,
  decryptSecret,
  encryptSecret,
  exchangeQuickBooksAuthorizationCode,
  fetchQuickBooksCompanyInfo,
  isQuickBooksReauthRequired,
  quickBooksReauthDueAt,
  refreshQuickBooksAccessToken,
  revokeQuickBooksToken,
  shouldPromptQuickBooksReauth,
  type QuickBooksEnvironment,
} from "@morgan/integrations";

export type QuickBooksCredentialPayload = {
  access_token: string;
  refresh_token: string;
  realm_id: string;
  token_type?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number | null;
  scopes: string;
};

export type QuickBooksIntegrationCard = {
  provider: "quickbooks";
  status: "connected" | "syncing" | "error" | "disconnected";
  last_sync_at: string | null;
  error_message: string | null;
  company_id: string | null;
  company_name: string | null;
  needs_company_selection: boolean;
  needs_reauth: boolean;
  reauth_due_at: string | null;
  books_initial_sync_completed: boolean;
  sync_failure_count: number;
};

function accessTokenExpiresAt(expiresIn?: number | null): Date | null {
  if (!expiresIn || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function upsertQuickBooksIntegration(
  db: Database,
  storeId: string,
  scopes: string,
): Promise<{ integrationId: string }> {
  const [existing] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
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
      provider: "quickbooks",
      status: "syncing",
      scopes,
    })
    .returning({ id: integrations.id });

  return { integrationId: created.id };
}

async function saveQuickBooksCredentials(
  db: Database,
  integrationId: string,
  payload: QuickBooksCredentialPayload,
  encryptionKey: string,
): Promise<void> {
  const encryptedPayload = encryptSecret(JSON.stringify(payload), encryptionKey);
  const expiresAt = accessTokenExpiresAt(payload.expires_in ?? null);

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

async function ensureQuickBooksStateRow(db: Database, integrationId: string) {
  await db.insert(quickbooksIntegrationState).values({ integrationId }).onConflictDoNothing();
}

async function upsertDiscoveredCompany(
  db: Database,
  integrationId: string,
  company: { realmId: string; companyName: string; country?: string | null },
): Promise<void> {
  await db
    .insert(quickbooksCompanies)
    .values({
      integrationId,
      realmId: company.realmId,
      companyName: company.companyName,
      country: company.country ?? null,
      isSelected: false,
    })
    .onConflictDoUpdate({
      target: [quickbooksCompanies.integrationId, quickbooksCompanies.realmId],
      set: {
        companyName: company.companyName,
        country: company.country ?? null,
      },
    });
}

export async function getQuickBooksCredentials(
  db: Database,
  integrationId: string,
  encryptionKey: string,
): Promise<QuickBooksCredentialPayload | null> {
  const [cred] = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (!cred) return null;

  return JSON.parse(decryptSecret(cred.encryptedPayload, encryptionKey)) as QuickBooksCredentialPayload;
}

export async function getQuickBooksIntegrationForStore(
  db: Database,
  storeId: string,
): Promise<QuickBooksIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1);

  if (!integration) {
    return {
      provider: "quickbooks",
      status: "disconnected",
      last_sync_at: null,
      error_message: null,
      company_id: null,
      company_name: null,
      needs_company_selection: false,
      needs_reauth: false,
      reauth_due_at: null,
      books_initial_sync_completed: false,
      sync_failure_count: 0,
    };
  }

  const [state] = await db
    .select()
    .from(quickbooksIntegrationState)
    .where(eq(quickbooksIntegrationState.integrationId, integration.id))
    .limit(1);

  const [selectedCompany] = await db
    .select()
    .from(quickbooksCompanies)
    .where(
      and(
        eq(quickbooksCompanies.integrationId, integration.id),
        eq(quickbooksCompanies.isSelected, true),
      ),
    )
    .limit(1);

  const needsReauth =
    state?.needsReauth ||
    isQuickBooksReauthRequired(state?.authorizedAt ?? integration.connectedAt ?? null);

  return {
    provider: "quickbooks",
    status: needsReauth ? "error" : integration.status,
    last_sync_at: integration.lastSyncAt?.toISOString() ?? null,
    error_message: needsReauth
      ? "QuickBooks authorization is due for renewal. Reconnect to continue syncing books."
      : (state?.lastError ?? null),
    company_id: selectedCompany?.realmId ?? null,
    company_name: selectedCompany?.companyName ?? null,
    needs_company_selection: state?.pendingCompanySelection ?? false,
    needs_reauth: needsReauth,
    reauth_due_at: state?.reauthDueAt?.toISOString() ?? null,
    books_initial_sync_completed: state?.booksInitialSyncCompleted ?? false,
    sync_failure_count: state?.syncFailureCount ?? 0,
  };
}

export async function completeQuickBooksOAuth(
  db: Database,
  input: {
    storeId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
    realmId: string;
    environment: QuickBooksEnvironment;
    encryptionKey: string;
  },
): Promise<{ needsCompanySelection: boolean; companyCount: number }> {
  const tokens = await exchangeQuickBooksAuthorizationCode({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    code: input.code,
  });

  const company = await fetchQuickBooksCompanyInfo({
    environment: input.environment,
    accessToken: tokens.access_token,
    realmId: input.realmId,
  });

  const { integrationId } = await upsertQuickBooksIntegration(
    db,
    input.storeId,
    QUICKBOOKS_ACCOUNTING_SCOPE,
  );

  await saveQuickBooksCredentials(
    db,
    integrationId,
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      realm_id: input.realmId,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      x_refresh_token_expires_in: tokens.x_refresh_token_expires_in ?? null,
      scopes: QUICKBOOKS_ACCOUNTING_SCOPE,
    },
    input.encryptionKey,
  );

  await ensureQuickBooksStateRow(db, integrationId);
  await upsertDiscoveredCompany(db, integrationId, company);

  const companies = await db
    .select()
    .from(quickbooksCompanies)
    .where(eq(quickbooksCompanies.integrationId, integrationId));

  const selectedCount = companies.filter((row) => row.isSelected).length;
  const matchingRealm = companies.find((row) => row.realmId === input.realmId);
  const needsCompanySelection = companies.length > 1 && selectedCount === 0;

  const authorizedAt = new Date();
  const reauthDueAt = quickBooksReauthDueAt(authorizedAt);

  if (!needsCompanySelection && matchingRealm) {
    await db
      .update(quickbooksCompanies)
      .set({ isSelected: false })
      .where(eq(quickbooksCompanies.integrationId, integrationId));

    await db
      .update(quickbooksCompanies)
      .set({ isSelected: true })
      .where(eq(quickbooksCompanies.id, matchingRealm.id));

    await db
      .update(integrations)
      .set({ status: "connected", lastSyncAt: new Date() })
      .where(eq(integrations.id, integrationId));
  }

  await db
    .update(quickbooksIntegrationState)
    .set({
      pendingCompanySelection: needsCompanySelection,
      refreshFailureCount: 0,
      authorizedAt,
      reauthDueAt,
      needsReauth: false,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(quickbooksIntegrationState.integrationId, integrationId));

  if (!needsCompanySelection) {
    setImmediate(() => {
      void import("./quickbooks-sync-service.js").then(({ syncQuickBooksBooksForStore }) =>
        syncQuickBooksBooksForStore(db, input.storeId).catch(() => undefined),
      );
    });
  }

  return {
    needsCompanySelection,
    companyCount: companies.length,
  };
}

export async function listQuickBooksCompanies(db: Database, storeId: string) {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1);

  if (!integration) return [];

  const rows = await db
    .select()
    .from(quickbooksCompanies)
    .where(eq(quickbooksCompanies.integrationId, integration.id));

  return rows.map((row) => ({
    id: row.realmId,
    name: row.companyName,
    country: row.country,
    is_selected: row.isSelected,
  }));
}

export async function selectQuickBooksCompany(
  db: Database,
  storeId: string,
  realmId: string,
  encryptionKey: string,
): Promise<QuickBooksIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1);

  if (!integration) {
    throw new Error("quickbooks_not_connected");
  }

  const [company] = await db
    .select()
    .from(quickbooksCompanies)
    .where(
      and(
        eq(quickbooksCompanies.integrationId, integration.id),
        eq(quickbooksCompanies.realmId, realmId),
      ),
    )
    .limit(1);

  if (!company) {
    throw new Error("company_not_found");
  }

  const credentials = await getQuickBooksCredentials(db, integration.id, encryptionKey);
  if (!credentials) {
    throw new Error("quickbooks_credentials_missing");
  }

  await saveQuickBooksCredentials(
    db,
    integration.id,
    {
      ...credentials,
      realm_id: realmId,
    },
    encryptionKey,
  );

  await db
    .update(quickbooksCompanies)
    .set({ isSelected: false })
    .where(eq(quickbooksCompanies.integrationId, integration.id));

  await db
    .update(quickbooksCompanies)
    .set({ isSelected: true })
    .where(eq(quickbooksCompanies.id, company.id));

  await db
    .update(quickbooksIntegrationState)
    .set({
      pendingCompanySelection: false,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(quickbooksIntegrationState.integrationId, integration.id));

  await db
    .update(integrations)
    .set({ status: "connected", lastSyncAt: new Date() })
    .where(eq(integrations.id, integration.id));

  setImmediate(() => {
    void import("./quickbooks-sync-service.js").then(({ syncQuickBooksBooksForStore }) =>
      syncQuickBooksBooksForStore(db, storeId).catch(() => undefined),
    );
  });

  return getQuickBooksIntegrationForStore(db, storeId);
}

export async function disconnectQuickBooksIntegration(
  db: Database,
  storeId: string,
  input: {
    clientId: string;
    clientSecret: string;
    encryptionKey: string;
  },
): Promise<QuickBooksIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1);

  if (!integration) {
    return getQuickBooksIntegrationForStore(db, storeId);
  }

  const credentials = await getQuickBooksCredentials(db, integration.id, input.encryptionKey);
  if (credentials?.refresh_token) {
    try {
      await revokeQuickBooksToken({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        token: credentials.refresh_token,
      });
    } catch {
      // Best-effort revoke at Intuit.
    }
  }

  await db
    .update(integrations)
    .set({ status: "disconnected" })
    .where(eq(integrations.id, integration.id));

  await db.delete(quickbooksCompanies).where(eq(quickbooksCompanies.integrationId, integration.id));
  await db
    .delete(quickbooksIntegrationState)
    .where(eq(quickbooksIntegrationState.integrationId, integration.id));
  await db
    .delete(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integration.id));

  return getQuickBooksIntegrationForStore(db, storeId);
}

export async function refreshQuickBooksTokens(
  db: Database,
  input: {
    encryptionKey: string;
    clientId: string;
    clientSecret: string;
    refreshWithinMs: number;
    reauthPromptWithinMs: number;
  },
): Promise<void> {
  const rows = await db
    .select({
      integration: integrations,
      credential: integrationCredentials,
      state: quickbooksIntegrationState,
    })
    .from(integrations)
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .leftJoin(
      quickbooksIntegrationState,
      eq(quickbooksIntegrationState.integrationId, integrations.id),
    )
    .where(
      and(
        eq(integrations.provider, "quickbooks"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  const refreshCutoff = new Date(Date.now() + input.refreshWithinMs);

  for (const row of rows) {
    const state = row.state;
    if (state?.pendingCompanySelection) continue;

    const authorizedAt = state?.authorizedAt ?? row.integration.connectedAt;
    if (isQuickBooksReauthRequired(authorizedAt)) {
      await markQuickBooksReauthRequired(db, row.integration.id, row.integration.storeId);
      continue;
    }

    if (shouldPromptQuickBooksReauth(authorizedAt, new Date(), input.reauthPromptWithinMs)) {
      await maybeCreateQuickBooksReauthPrompt(db, row.integration.storeId, state?.reauthDueAt);
    }

    const expiresAt = row.credential.expiresAt;
    if (expiresAt && expiresAt > refreshCutoff) continue;

    let payload: QuickBooksCredentialPayload;
    try {
      payload = JSON.parse(
        decryptSecret(row.credential.encryptedPayload, input.encryptionKey),
      ) as QuickBooksCredentialPayload;
    } catch {
      await recordQuickBooksRefreshFailure(
        db,
        row.integration.id,
        row.integration.storeId,
        "Could not decrypt QuickBooks credentials",
      );
      continue;
    }

    try {
      const refreshed = await refreshQuickBooksAccessToken({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        refreshToken: payload.refresh_token,
      });

      await saveQuickBooksCredentials(
        db,
        row.integration.id,
        {
          ...payload,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
          x_refresh_token_expires_in: refreshed.x_refresh_token_expires_in ?? null,
        },
        input.encryptionKey,
      );

      await db
        .update(quickbooksIntegrationState)
        .set({
          refreshFailureCount: 0,
          lastTokenRefreshAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(quickbooksIntegrationState.integrationId, row.integration.id));

      if (row.integration.status === "error" && !state?.needsReauth) {
        await db
          .update(integrations)
          .set({ status: "connected" })
          .where(eq(integrations.id, row.integration.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "QuickBooks token refresh failed";
      await recordQuickBooksRefreshFailure(db, row.integration.id, row.integration.storeId, message);
    }
  }
}

async function markQuickBooksReauthRequired(db: Database, integrationId: string, storeId: string) {
  await db
    .insert(quickbooksIntegrationState)
    .values({
      integrationId,
      needsReauth: true,
      lastError: "QuickBooks authorization expired. Reconnect to continue syncing books.",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: quickbooksIntegrationState.integrationId,
      set: {
        needsReauth: true,
        lastError: "QuickBooks authorization expired. Reconnect to continue syncing books.",
        updatedAt: new Date(),
      },
    });

  await db.update(integrations).set({ status: "error" }).where(eq(integrations.id, integrationId));

  await db
    .insert(alerts)
    .values({
      storeId,
      severity: "warning",
      type: "quickbooks_reauth_required",
      title: "QuickBooks needs to be reconnected",
      body: "Your QuickBooks authorization is due for renewal. Reconnect in Integrations to keep books in sync.",
      dedupeKey: "quickbooks_reauth_required",
    })
    .onConflictDoNothing();
}

async function maybeCreateQuickBooksReauthPrompt(
  db: Database,
  storeId: string,
  reauthDueAt: Date | null | undefined,
) {
  const dueLabel = reauthDueAt?.toISOString().slice(0, 10) ?? "soon";
  await db
    .insert(alerts)
    .values({
      storeId,
      severity: "info",
      type: "quickbooks_reauth_prompt",
      title: "QuickBooks reconnection coming up",
      body: `QuickBooks authorization should be renewed by ${dueLabel} to avoid sync interruption.`,
      dedupeKey: `quickbooks_reauth_prompt:${dueLabel}`,
    })
    .onConflictDoNothing();
}

async function recordQuickBooksRefreshFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  const [state] = await db
    .select()
    .from(quickbooksIntegrationState)
    .where(eq(quickbooksIntegrationState.integrationId, integrationId))
    .limit(1);

  const failureCount = (state?.refreshFailureCount ?? 0) + 1;

  await db
    .insert(quickbooksIntegrationState)
    .values({
      integrationId,
      refreshFailureCount: failureCount,
      lastError: message,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: quickbooksIntegrationState.integrationId,
      set: {
        refreshFailureCount: failureCount,
        lastError: message,
        updatedAt: new Date(),
      },
    });

  if (failureCount >= 2) {
    await db.update(integrations).set({ status: "error" }).where(eq(integrations.id, integrationId));

    await db
      .insert(alerts)
      .values({
        storeId,
        severity: "warning",
        type: "quickbooks_token_refresh_failed",
        title: "QuickBooks connection needs attention",
        body: "We could not refresh your QuickBooks access token. Reconnect QuickBooks in Integrations.",
        dedupeKey: "quickbooks_token_refresh_failed",
      })
      .onConflictDoNothing();
  }
}

export function isQuickBooksConnected(db: Database, storeId: string): Promise<boolean> {
  return db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1)
    .then(([row]) => row?.status === "connected");
}
