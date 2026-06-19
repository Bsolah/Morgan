import { and, eq, inArray } from "drizzle-orm";
import {
  alerts,
  integrationCredentials,
  integrations,
  xeroIntegrationState,
  xeroTenants,
  type Database,
} from "@morgan/db";
import {
  XERO_ACCOUNTING_SCOPES,
  decryptSecret,
  encryptSecret,
  exchangeXeroAuthorizationCode,
  fetchXeroConnections,
  isXeroReauthRequired,
  refreshXeroAccessToken,
  revokeXeroConnection,
  shouldPromptXeroReauth,
  xeroReauthDueAt,
} from "@morgan/integrations";

export type XeroCredentialPayload = {
  access_token: string;
  refresh_token: string;
  tenant_id: string | null;
  connection_id: string | null;
  token_type?: string;
  expires_in?: number;
  scopes: string;
};

export type XeroIntegrationCard = {
  provider: "xero";
  status: "connected" | "syncing" | "error" | "disconnected";
  availability: "available";
  last_sync_at: string | null;
  error_message: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  needs_tenant_selection: boolean;
  needs_reauth: boolean;
  reauth_due_at: string | null;
  books_initial_sync_completed: boolean;
  sync_failure_count: number;
};

function accessTokenExpiresAt(expiresIn?: number | null): Date | null {
  if (!expiresIn || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function upsertXeroIntegration(
  db: Database,
  storeId: string,
  scopes: string,
): Promise<{ integrationId: string }> {
  const [existing] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
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
      provider: "xero",
      status: "syncing",
      scopes,
    })
    .returning({ id: integrations.id });

  return { integrationId: created.id };
}

async function saveXeroCredentials(
  db: Database,
  integrationId: string,
  payload: XeroCredentialPayload,
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

async function ensureXeroStateRow(db: Database, integrationId: string) {
  await db.insert(xeroIntegrationState).values({ integrationId }).onConflictDoNothing();
}

async function upsertDiscoveredTenants(
  db: Database,
  integrationId: string,
  connections: Awaited<ReturnType<typeof fetchXeroConnections>>,
) {
  for (const connection of connections) {
    await db
      .insert(xeroTenants)
      .values({
        integrationId,
        connectionId: connection.id,
        tenantId: connection.tenantId,
        tenantName: connection.tenantName,
        tenantType: connection.tenantType,
        isSelected: false,
      })
      .onConflictDoUpdate({
        target: [xeroTenants.integrationId, xeroTenants.tenantId],
        set: {
          connectionId: connection.id,
          tenantName: connection.tenantName,
          tenantType: connection.tenantType,
        },
      });
  }
}

export async function getXeroCredentials(
  db: Database,
  integrationId: string,
  encryptionKey: string,
): Promise<XeroCredentialPayload | null> {
  const [cred] = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (!cred) return null;

  return JSON.parse(decryptSecret(cred.encryptedPayload, encryptionKey)) as XeroCredentialPayload;
}

export async function getXeroIntegrationForStore(
  db: Database,
  storeId: string,
): Promise<XeroIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
    .limit(1);

  if (!integration) {
    return {
      provider: "xero",
      status: "disconnected",
      availability: "available",
      last_sync_at: null,
      error_message: null,
      tenant_id: null,
      tenant_name: null,
      needs_tenant_selection: false,
      needs_reauth: false,
      reauth_due_at: null,
      books_initial_sync_completed: false,
      sync_failure_count: 0,
    };
  }

  const [state] = await db
    .select()
    .from(xeroIntegrationState)
    .where(eq(xeroIntegrationState.integrationId, integration.id))
    .limit(1);

  const [selectedTenant] = await db
    .select()
    .from(xeroTenants)
    .where(and(eq(xeroTenants.integrationId, integration.id), eq(xeroTenants.isSelected, true)))
    .limit(1);

  const needsReauth =
    state?.needsReauth ||
    isXeroReauthRequired(state?.authorizedAt ?? integration.connectedAt ?? null);

  return {
    provider: "xero",
    status: needsReauth ? "error" : integration.status,
    availability: "available",
    last_sync_at: integration.lastSyncAt?.toISOString() ?? null,
    error_message: needsReauth
      ? "Xero authorization is due for renewal. Reconnect to continue syncing books."
      : (state?.lastError ?? null),
    tenant_id: selectedTenant?.tenantId ?? null,
    tenant_name: selectedTenant?.tenantName ?? null,
    needs_tenant_selection: state?.pendingTenantSelection ?? false,
    needs_reauth: needsReauth,
    reauth_due_at: state?.reauthDueAt?.toISOString() ?? null,
    books_initial_sync_completed: state?.booksInitialSyncCompleted ?? false,
    sync_failure_count: state?.syncFailureCount ?? 0,
  };
}

export async function completeXeroOAuth(
  db: Database,
  input: {
    storeId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
    encryptionKey: string;
  },
): Promise<{ needsTenantSelection: boolean; tenantCount: number }> {
  const tokens = await exchangeXeroAuthorizationCode({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    code: input.code,
  });

  const connections = await fetchXeroConnections(tokens.access_token);
  if (connections.length === 0) {
    throw new Error("missing_tenant");
  }

  const { integrationId } = await upsertXeroIntegration(db, input.storeId, XERO_ACCOUNTING_SCOPES);

  await saveXeroCredentials(
    db,
    integrationId,
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      tenant_id: connections.length === 1 ? connections[0]!.tenantId : null,
      connection_id: connections.length === 1 ? connections[0]!.id : null,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      scopes: XERO_ACCOUNTING_SCOPES,
    },
    input.encryptionKey,
  );

  await ensureXeroStateRow(db, integrationId);
  await upsertDiscoveredTenants(db, integrationId, connections);

  const tenants = await db
    .select()
    .from(xeroTenants)
    .where(eq(xeroTenants.integrationId, integrationId));

  const selectedCount = tenants.filter((row) => row.isSelected).length;
  const needsTenantSelection = tenants.length > 1 && selectedCount === 0;

  const authorizedAt = new Date();
  const reauthDueAt = xeroReauthDueAt(authorizedAt);

  if (!needsTenantSelection && tenants.length === 1) {
    const tenant = tenants[0]!;
    await db.update(xeroTenants).set({ isSelected: true }).where(eq(xeroTenants.id, tenant.id));

    await saveXeroCredentials(
      db,
      integrationId,
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        tenant_id: tenant.tenantId,
        connection_id: tenant.connectionId,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scopes: XERO_ACCOUNTING_SCOPES,
      },
      input.encryptionKey,
    );

    await db
      .update(integrations)
      .set({ status: "connected", lastSyncAt: new Date() })
      .where(eq(integrations.id, integrationId));
  }

  await db
    .update(xeroIntegrationState)
    .set({
      pendingTenantSelection: needsTenantSelection,
      refreshFailureCount: 0,
      authorizedAt,
      reauthDueAt,
      needsReauth: false,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(xeroIntegrationState.integrationId, integrationId));

  if (!needsTenantSelection) {
    setImmediate(() => {
      void import("./xero-sync-service.js").then(({ syncXeroBooksForStore }) =>
        syncXeroBooksForStore(db, input.storeId).catch(() => undefined),
      );
    });
  }

  return {
    needsTenantSelection,
    tenantCount: tenants.length,
  };
}

export async function listXeroTenants(db: Database, storeId: string) {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
    .limit(1);

  if (!integration) return [];

  const rows = await db
    .select()
    .from(xeroTenants)
    .where(eq(xeroTenants.integrationId, integration.id));

  return rows.map((row) => ({
    id: row.tenantId,
    name: row.tenantName,
    tenant_type: row.tenantType,
    is_selected: row.isSelected,
  }));
}

export async function selectXeroTenant(
  db: Database,
  storeId: string,
  tenantId: string,
  encryptionKey: string,
): Promise<XeroIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
    .limit(1);

  if (!integration) throw new Error("xero_not_connected");

  const [tenant] = await db
    .select()
    .from(xeroTenants)
    .where(and(eq(xeroTenants.integrationId, integration.id), eq(xeroTenants.tenantId, tenantId)))
    .limit(1);

  if (!tenant) throw new Error("tenant_not_found");

  const credentials = await getXeroCredentials(db, integration.id, encryptionKey);
  if (!credentials) throw new Error("xero_credentials_missing");

  await saveXeroCredentials(
    db,
    integration.id,
    {
      ...credentials,
      tenant_id: tenant.tenantId,
      connection_id: tenant.connectionId,
    },
    encryptionKey,
  );

  await db.update(xeroTenants).set({ isSelected: false }).where(eq(xeroTenants.integrationId, integration.id));
  await db.update(xeroTenants).set({ isSelected: true }).where(eq(xeroTenants.id, tenant.id));

  await db
    .update(xeroIntegrationState)
    .set({ pendingTenantSelection: false, lastError: null, updatedAt: new Date() })
    .where(eq(xeroIntegrationState.integrationId, integration.id));

  await db
    .update(integrations)
    .set({ status: "connected", lastSyncAt: new Date() })
    .where(eq(integrations.id, integration.id));

  setImmediate(() => {
    void import("./xero-sync-service.js").then(({ syncXeroBooksForStore }) =>
      syncXeroBooksForStore(db, storeId).catch(() => undefined),
    );
  });

  return getXeroIntegrationForStore(db, storeId);
}

export async function disconnectXeroIntegration(
  db: Database,
  storeId: string,
  input: { encryptionKey: string },
): Promise<XeroIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
    .limit(1);

  if (!integration) return getXeroIntegrationForStore(db, storeId);

  const credentials = await getXeroCredentials(db, integration.id, input.encryptionKey);
  if (credentials?.access_token && credentials.connection_id) {
    try {
      await revokeXeroConnection({
        accessToken: credentials.access_token,
        connectionId: credentials.connection_id,
      });
    } catch {
      // Best-effort revoke.
    }
  }

  await db.update(integrations).set({ status: "disconnected" }).where(eq(integrations.id, integration.id));
  await db.delete(xeroTenants).where(eq(xeroTenants.integrationId, integration.id));
  await db.delete(xeroIntegrationState).where(eq(xeroIntegrationState.integrationId, integration.id));
  await db.delete(integrationCredentials).where(eq(integrationCredentials.integrationId, integration.id));

  return getXeroIntegrationForStore(db, storeId);
}

export async function refreshXeroTokens(
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
      state: xeroIntegrationState,
    })
    .from(integrations)
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .leftJoin(xeroIntegrationState, eq(xeroIntegrationState.integrationId, integrations.id))
    .where(
      and(
        eq(integrations.provider, "xero"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  const refreshCutoff = new Date(Date.now() + input.refreshWithinMs);

  for (const row of rows) {
    const state = row.state;
    if (state?.pendingTenantSelection) continue;

    const authorizedAt = state?.authorizedAt ?? row.integration.connectedAt;
    if (isXeroReauthRequired(authorizedAt)) {
      await markXeroReauthRequired(db, row.integration.id, row.integration.storeId);
      continue;
    }

    if (shouldPromptXeroReauth(authorizedAt, new Date(), input.reauthPromptWithinMs)) {
      await maybeCreateXeroReauthPrompt(db, row.integration.storeId, state?.reauthDueAt);
    }

    const expiresAt = row.credential.expiresAt;
    if (expiresAt && expiresAt > refreshCutoff) continue;

    let payload: XeroCredentialPayload;
    try {
      payload = JSON.parse(
        decryptSecret(row.credential.encryptedPayload, input.encryptionKey),
      ) as XeroCredentialPayload;
    } catch {
      await recordXeroRefreshFailure(
        db,
        row.integration.id,
        row.integration.storeId,
        "Could not decrypt Xero credentials",
      );
      continue;
    }

    try {
      const refreshed = await refreshXeroAccessToken({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        refreshToken: payload.refresh_token,
      });

      await saveXeroCredentials(
        db,
        row.integration.id,
        {
          ...payload,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
        },
        input.encryptionKey,
      );

      await db
        .update(xeroIntegrationState)
        .set({
          refreshFailureCount: 0,
          lastTokenRefreshAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(xeroIntegrationState.integrationId, row.integration.id));

      if (row.integration.status === "error" && !state?.needsReauth) {
        await db
          .update(integrations)
          .set({ status: "connected" })
          .where(eq(integrations.id, row.integration.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xero token refresh failed";
      await recordXeroRefreshFailure(db, row.integration.id, row.integration.storeId, message);
    }
  }
}

async function markXeroReauthRequired(db: Database, integrationId: string, storeId: string) {
  await db
    .insert(xeroIntegrationState)
    .values({
      integrationId,
      needsReauth: true,
      lastError: "Xero authorization expired. Reconnect to continue syncing books.",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: xeroIntegrationState.integrationId,
      set: {
        needsReauth: true,
        lastError: "Xero authorization expired. Reconnect to continue syncing books.",
        updatedAt: new Date(),
      },
    });

  await db.update(integrations).set({ status: "error" }).where(eq(integrations.id, integrationId));

  await db
    .insert(alerts)
    .values({
      storeId,
      severity: "warning",
      type: "xero_reauth_required",
      title: "Xero needs to be reconnected",
      body: "Your Xero authorization is due for renewal. Reconnect in Integrations to keep books in sync.",
      dedupeKey: "xero_reauth_required",
    })
    .onConflictDoNothing();
}

async function maybeCreateXeroReauthPrompt(
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
      type: "xero_reauth_prompt",
      title: "Xero reconnection coming up",
      body: `Xero authorization should be renewed by ${dueLabel} to avoid sync interruption.`,
      dedupeKey: `xero_reauth_prompt:${dueLabel}`,
    })
    .onConflictDoNothing();
}

async function recordXeroRefreshFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  const [state] = await db
    .select()
    .from(xeroIntegrationState)
    .where(eq(xeroIntegrationState.integrationId, integrationId))
    .limit(1);

  const failureCount = (state?.refreshFailureCount ?? 0) + 1;

  await db
    .insert(xeroIntegrationState)
    .values({
      integrationId,
      refreshFailureCount: failureCount,
      lastError: message,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: xeroIntegrationState.integrationId,
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
        type: "xero_token_refresh_failed",
        title: "Xero connection needs attention",
        body: "We could not refresh your Xero access token. Reconnect Xero in Integrations.",
        dedupeKey: "xero_token_refresh_failed",
      })
      .onConflictDoNothing();
  }
}

export async function getSelectedXeroTenantId(
  db: Database,
  integrationId: string,
): Promise<string | null> {
  const [tenant] = await db
    .select({ tenantId: xeroTenants.tenantId })
    .from(xeroTenants)
    .where(and(eq(xeroTenants.integrationId, integrationId), eq(xeroTenants.isSelected, true)))
    .limit(1);

  return tenant?.tenantId ?? null;
}
