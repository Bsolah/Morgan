import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  integrationCredentials,
  integrations,
  organizations,
  stores,
  syncRuns,
  users,
  type Database,
} from "@morgan/db";
import { encryptSecret } from "@morgan/integrations";
import type { ShopifyShopInfo, ShopifyTokenResponse } from "@morgan/integrations";

export type ProvisionResult = {
  userId: string;
  orgId: string;
  storeId: string;
  shopDomain: string;
  isReconnect: boolean;
};

export async function provisionShopifyConnection(
  db: Database,
  input: {
    shopDomain: string;
    token: ShopifyTokenResponse;
    shopInfo: ShopifyShopInfo;
    encryptionKey: string;
    scopes: string;
  },
): Promise<ProvisionResult> {
  const email = input.shopInfo.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("missing_shop_email");
  }

  const [existingStore] = await db
    .select()
    .from(stores)
    .where(eq(stores.shopDomain, input.shopDomain))
    .limit(1);

  let orgId: string;
  let storeId: string;
  let isReconnect = false;

  if (existingStore) {
    isReconnect = existingStore.status === "uninstalled";
    orgId = existingStore.orgId;
    storeId = existingStore.id;

    await db
      .update(stores)
      .set({
        timezone: input.shopInfo.timezone,
        currency: input.shopInfo.currency,
        status: "syncing",
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId));
  } else {
    const [org] = await db
      .insert(organizations)
      .values({
        name: input.shopInfo.name || input.shopDomain,
        planTier: "trial",
      })
      .returning({ id: organizations.id });

    orgId = org.id;

    const [store] = await db
      .insert(stores)
      .values({
        orgId,
        platform: "shopify",
        shopDomain: input.shopDomain,
        timezone: input.shopInfo.timezone,
        currency: input.shopInfo.currency,
        status: "syncing",
      })
      .returning({ id: stores.id });

    storeId = store.id;
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      displayName: input.shopInfo.shop_owner || input.shopInfo.name,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        displayName: input.shopInfo.shop_owner || input.shopInfo.name,
      },
    })
    .returning({ id: users.id });

  const [existingIntegration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "shopify")))
    .limit(1);

  const payload = JSON.stringify({
    access_token: input.token.access_token,
    refresh_token: input.token.refresh_token ?? null,
    scope: input.token.scope ?? input.scopes,
    shop_domain: input.shopDomain,
    expires_in: input.token.expires_in ?? null,
    refresh_token_expires_in: input.token.refresh_token_expires_in ?? null,
  });

  const encryptedPayload = encryptSecret(payload, input.encryptionKey);

  let integrationId: string;

  if (existingIntegration) {
    integrationId = existingIntegration.id;
    await db
      .update(integrations)
      .set({
        status: "connected",
        scopes: input.token.scope ?? input.scopes,
        connectedAt: new Date(),
        lastSyncAt: null,
      })
      .where(eq(integrations.id, integrationId));

    const [existingCredential] = await db
      .select()
      .from(integrationCredentials)
      .where(eq(integrationCredentials.integrationId, integrationId))
      .limit(1);

    if (existingCredential) {
      await db
        .update(integrationCredentials)
        .set({ encryptedPayload })
        .where(eq(integrationCredentials.id, existingCredential.id));
    } else {
      await db.insert(integrationCredentials).values({
        integrationId,
        encryptedPayload,
      });
    }
  } else {
    integrationId = randomUUID();
    await db.insert(integrations).values({
      id: integrationId,
      storeId,
      provider: "shopify",
      status: "connected",
      scopes: input.token.scope ?? input.scopes,
    });
    await db.insert(integrationCredentials).values({
      integrationId,
      encryptedPayload,
    });
  }

  await db.insert(syncRuns).values({
    storeId,
    status: "pending",
    triggeredBy: isReconnect ? "oauth_reconnect" : "oauth_connect",
  });

  return {
    userId: user.id,
    orgId,
    storeId,
    shopDomain: input.shopDomain,
    isReconnect,
  };
}
