import { and, eq } from "drizzle-orm";
import {
  integrationCredentials,
  integrations,
  cashRunwaySnapshots,
  payoutDepositMatches,
  payoutMatchAuditLog,
  plaidBankAccounts,
  plaidClassificationBatches,
  plaidClassificationQueue,
  plaidIntegrationState,
  plaidTransactions,
  type Database,
} from "@morgan/db";
import {
  createPlaidLinkToken,
  decryptSecret,
  encryptSecret,
  exchangePlaidPublicToken,
  fetchPlaidAccounts,
  pickPreferredBusinessAccount,
  PLAID_PRIVACY_DISCLOSURE,
  removePlaidItem,
  type PlaidEnvironment,
} from "@morgan/integrations";
import { getPendingUncategorizedCount } from "./plaid-transaction-sync-service.js";

export type PlaidCredentialPayload = {
  access_token: string;
  item_id: string;
};

export type PlaidIntegrationCard = {
  provider: "plaid";
  status: "connected" | "syncing" | "error" | "disconnected";
  last_sync_at: string | null;
  initial_sync_completed: boolean;
  pending_uncategorized_count: number;
  error_message: string | null;
  institution_name: string | null;
  account_name: string | null;
  account_mask: string | null;
  account_subtype: string | null;
  privacy_disclosure: string;
};

function plaidConfig(input: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
}) {
  return input;
}

export async function getPlaidIntegrationForStore(
  db: Database,
  storeId: string,
): Promise<PlaidIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "plaid")))
    .limit(1);

  if (!integration) {
    return {
      provider: "plaid",
      status: "disconnected",
      last_sync_at: null,
      initial_sync_completed: false,
      pending_uncategorized_count: 0,
      error_message: null,
      institution_name: null,
      account_name: null,
      account_mask: null,
      account_subtype: null,
      privacy_disclosure: PLAID_PRIVACY_DISCLOSURE,
    };
  }

  const [account] = await db
    .select()
    .from(plaidBankAccounts)
    .where(
      and(eq(plaidBankAccounts.integrationId, integration.id), eq(plaidBankAccounts.isPrimary, true)),
    )
    .limit(1);

  const [state] = await db
    .select()
    .from(plaidIntegrationState)
    .where(eq(plaidIntegrationState.integrationId, integration.id))
    .limit(1);

  const pendingUncategorizedCount = await getPendingUncategorizedCount(db, storeId);

  return {
    provider: "plaid",
    status: integration.status,
    last_sync_at: integration.lastSyncAt?.toISOString() ?? null,
    initial_sync_completed: state?.initialSyncCompleted ?? false,
    pending_uncategorized_count: pendingUncategorizedCount,
    error_message: state?.lastError ?? null,
    institution_name: account?.institutionName ?? null,
    account_name: account?.accountName ?? null,
    account_mask: account?.accountMask ?? null,
    account_subtype: account?.accountSubtype ?? null,
    privacy_disclosure: PLAID_PRIVACY_DISCLOSURE,
  };
}

export async function createPlaidLinkTokenForStore(
  db: Database,
  storeId: string,
  config: ReturnType<typeof plaidConfig>,
): Promise<{ link_token: string; expiration: string; privacy_disclosure: string }> {
  const response = await createPlaidLinkToken({
    clientId: config.clientId,
    secret: config.secret,
    environment: config.environment,
    clientUserId: storeId,
  });

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "plaid")))
    .limit(1);

  if (existing) {
    await db
      .update(integrations)
      .set({ status: "syncing", scopes: "transactions" })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      storeId,
      provider: "plaid",
      status: "syncing",
      scopes: "transactions",
    });
  }

  return {
    link_token: response.link_token,
    expiration: response.expiration,
    privacy_disclosure: PLAID_PRIVACY_DISCLOSURE,
  };
}

async function getPlaidCredentials(
  db: Database,
  integrationId: string,
  encryptionKey: string,
): Promise<PlaidCredentialPayload | null> {
  const [cred] = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (!cred) return null;

  return JSON.parse(decryptSecret(cred.encryptedPayload, encryptionKey)) as PlaidCredentialPayload;
}

export async function exchangePlaidPublicTokenForStore(
  db: Database,
  storeId: string,
  publicToken: string,
  config: ReturnType<typeof plaidConfig>,
  encryptionKey: string,
): Promise<PlaidIntegrationCard> {
  const exchange = await exchangePlaidPublicToken({
    clientId: config.clientId,
    secret: config.secret,
    environment: config.environment,
    publicToken,
  });

  const accountsPayload = await fetchPlaidAccounts({
    clientId: config.clientId,
    secret: config.secret,
    environment: config.environment,
    accessToken: exchange.access_token,
  });

  const preferredAccount = pickPreferredBusinessAccount(accountsPayload.accounts);
  if (!preferredAccount) {
    throw new Error("no_eligible_accounts");
  }

  const institutionName = accountsPayload.institution?.name ?? null;

  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "plaid")))
    .limit(1);

  let integrationId = integration?.id;

  if (integration) {
    await db
      .update(integrations)
      .set({
        status: "syncing",
        scopes: "transactions",
        connectedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  } else {
    const [created] = await db
      .insert(integrations)
      .values({
        storeId,
        provider: "plaid",
        status: "syncing",
        scopes: "transactions",
      })
      .returning({ id: integrations.id });
    integrationId = created.id;
  }

  if (!integrationId) {
    throw new Error("plaid_integration_missing");
  }

  await db.delete(payoutMatchAuditLog).where(eq(payoutMatchAuditLog.storeId, storeId));
  await db.delete(payoutDepositMatches).where(eq(payoutDepositMatches.storeId, storeId));
  await db.delete(cashRunwaySnapshots).where(eq(cashRunwaySnapshots.storeId, storeId));
  await db.delete(plaidClassificationQueue).where(eq(plaidClassificationQueue.storeId, storeId));
  await db.delete(plaidClassificationBatches).where(eq(plaidClassificationBatches.storeId, storeId));
  await db.delete(plaidTransactions).where(eq(plaidTransactions.storeId, storeId));

  const encryptedPayload = encryptSecret(
    JSON.stringify({
      access_token: exchange.access_token,
      item_id: exchange.item_id,
    } satisfies PlaidCredentialPayload),
    encryptionKey,
  );

  const [existingCred] = await db
    .select({ id: integrationCredentials.id })
    .from(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integrationId))
    .limit(1);

  if (existingCred) {
    await db
      .update(integrationCredentials)
      .set({ encryptedPayload, expiresAt: null })
      .where(eq(integrationCredentials.id, existingCred.id));
  } else {
    await db.insert(integrationCredentials).values({
      integrationId,
      encryptedPayload,
    });
  }

  await db.delete(plaidBankAccounts).where(eq(plaidBankAccounts.integrationId, integrationId));

  await db.insert(plaidBankAccounts).values({
    integrationId,
    plaidAccountId: preferredAccount.account_id,
    plaidItemId: exchange.item_id,
    institutionName,
    accountName: preferredAccount.name,
    accountMask: preferredAccount.mask,
    accountType: preferredAccount.type,
    accountSubtype: preferredAccount.subtype,
    isPrimary: true,
  });

  await db
    .insert(plaidIntegrationState)
    .values({
      integrationId,
      lastError: null,
      transactionsCursor: null,
      initialSyncCompleted: false,
    })
    .onConflictDoUpdate({
      target: plaidIntegrationState.integrationId,
      set: {
        lastError: null,
        transactionsCursor: null,
        initialSyncCompleted: false,
        updatedAt: new Date(),
      },
    });

  return getPlaidIntegrationForStore(db, storeId);
}

export async function disconnectPlaidIntegration(
  db: Database,
  storeId: string,
  config: ReturnType<typeof plaidConfig>,
  encryptionKey: string,
): Promise<PlaidIntegrationCard> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "plaid")))
    .limit(1);

  if (!integration) {
    return getPlaidIntegrationForStore(db, storeId);
  }

  const credentials = await getPlaidCredentials(db, integration.id, encryptionKey);
  if (credentials?.access_token) {
    try {
      await removePlaidItem({
        clientId: config.clientId,
        secret: config.secret,
        environment: config.environment,
        accessToken: credentials.access_token,
      });
    } catch {
      // Best-effort revoke at Plaid.
    }
  }

  await db
    .update(integrations)
    .set({ status: "disconnected", lastSyncAt: integration.lastSyncAt })
    .where(eq(integrations.id, integration.id));

  await db.delete(payoutMatchAuditLog).where(eq(payoutMatchAuditLog.storeId, storeId));
  await db.delete(payoutDepositMatches).where(eq(payoutDepositMatches.storeId, storeId));
  await db.delete(cashRunwaySnapshots).where(eq(cashRunwaySnapshots.storeId, storeId));
  await db.delete(plaidClassificationQueue).where(eq(plaidClassificationQueue.storeId, storeId));
  await db.delete(plaidClassificationBatches).where(eq(plaidClassificationBatches.storeId, storeId));
  await db.delete(plaidTransactions).where(eq(plaidTransactions.storeId, storeId));
  await db.delete(integrationCredentials).where(eq(integrationCredentials.integrationId, integration.id));
  await db.delete(plaidBankAccounts).where(eq(plaidBankAccounts.integrationId, integration.id));
  await db.delete(plaidIntegrationState).where(eq(plaidIntegrationState.integrationId, integration.id));

  return getPlaidIntegrationForStore(db, storeId);
}

export { plaidConfig };
