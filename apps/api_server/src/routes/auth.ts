import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  SHOPIFY_OAUTH_ERROR_MESSAGES,
  ShopifyOAuthError,
  buildShopifyAuthorizeUrl,
  exchangeAuthorizationCode,
  fetchShopInfo,
  isValidShopDomain,
  normalizeShopInput,
  verifyShopifyOAuthHmac,
} from "@morgan/integrations";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/jwt.js";
import { requireAuth } from "../plugins/auth.js";
import {
  env,
  getMobileDeepLink,
  getShopifyOAuthCallbackUrl,
  isShopifyOAuthConfigured,
} from "../config.js";
import { getDb } from "../lib/db.js";
import {
  consumeConnectToken,
  consumeOAuthState,
  createOAuthState,
  issueConnectToken,
} from "../lib/shopify-oauth-state.js";
import { provisionShopifyConnection } from "../lib/shopify-connect-service.js";
import { enqueueOrderBackfill } from "../lib/order-backfill-service.js";
import { enqueueProductCatalogSync } from "../lib/product-catalog-service.js";
import { runOrderBackfillNow } from "../lib/order-backfill-runner.js";
import { runProductCatalogNow } from "../lib/product-catalog-runner.js";
import { runPayoutSyncNow } from "../lib/payout-sync-runner.js";

const tokenExchangeSchema = z.object({
  connect_token: z.string().min(1).optional(),
  session_token: z.string().min(1).optional(),
  shop_domain: z.string().min(3).optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const STUB_ORG_ID = "00000000-0000-4000-8000-000000000001";
const STUB_STORE_ID = "00000000-0000-4000-8000-000000000002";
const STUB_USER_ID = "00000000-0000-4000-8000-000000000003";

function redirectMobile(reply: FastifyReply, path: string, params: Record<string, string>) {
  return reply.redirect(getMobileDeepLink(path, params));
}

function redirectMobileError(reply: FastifyReply, code: keyof typeof SHOPIFY_OAUTH_ERROR_MESSAGES) {
  return redirectMobile(reply, "onboarding", { shopify_error: code });
}

async function issueJwtPair(claims: {
  sub: string;
  org_id: string;
  store_ids: string[];
  shop_domain: string;
}) {
  const [access_token, refresh_token] = await Promise.all([
    signAccessToken(claims),
    signRefreshToken(claims),
  ]);

  return {
    access_token,
    refresh_token,
    token_type: "Bearer" as const,
    expires_in: 900,
    store_id: claims.store_ids[0],
    shop_domain: claims.shop_domain,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/v1/auth/shopify/oauth/start", async (request, reply) => {
    if (!isShopifyOAuthConfigured()) {
      return reply.status(503).send({
        error: SHOPIFY_OAUTH_ERROR_MESSAGES.not_configured,
        code: "not_configured",
      });
    }

    const query = request.query as { shop?: string; platform?: string };
    const shop = normalizeShopInput(query.shop ?? "");
    if (!shop || !isValidShopDomain(shop)) {
      return reply.status(400).send({
        error: SHOPIFY_OAUTH_ERROR_MESSAGES.invalid_shop,
        code: "invalid_shop",
      });
    }

    const platform = query.platform === "mobile" ? "mobile" : "web";
    const callbackUrl = getShopifyOAuthCallbackUrl();
    const state = createOAuthState({ shop, platform, callbackUrl });

    const authorizeUrl = buildShopifyAuthorizeUrl({
      shopDomain: shop,
      clientId: env.SHOPIFY_API_KEY!,
      scopes: env.SHOPIFY_APP_SCOPES,
      redirectUri: callbackUrl,
      state,
    });

    return reply.redirect(authorizeUrl);
  });

  app.get("/api/v1/auth/shopify/callback", async (request, reply) => {
    if (!isShopifyOAuthConfigured()) {
      return redirectMobileError(reply, "not_configured");
    }

    const query = request.query as Record<string, string>;
    const { code, shop: shopParam, state, hmac } = query;

    if (!code || !shopParam || !state || !hmac) {
      return redirectMobileError(reply, "invalid_state");
    }

    const pending = consumeOAuthState(state);
    if (!pending || pending.shop !== shopParam) {
      return redirectMobileError(reply, "invalid_state");
    }

    if (!verifyShopifyOAuthHmac(query, env.SHOPIFY_API_SECRET!)) {
      return redirectMobileError(reply, "hmac_mismatch");
    }

    const db = getDb();
    if (!db) {
      request.log.error("DATABASE_URL not configured — cannot complete Shopify OAuth");
      return redirectMobileError(reply, "server_error");
    }

    try {
      const token = await exchangeAuthorizationCode({
        shopDomain: shopParam,
        clientId: env.SHOPIFY_API_KEY!,
        clientSecret: env.SHOPIFY_API_SECRET!,
        code,
      });

      const shopInfo = await fetchShopInfo(shopParam, token.access_token);
      const provisioned = await provisionShopifyConnection(db, {
        shopDomain: shopParam,
        token,
        shopInfo,
        encryptionKey: env.ENCRYPTION_KEY,
        scopes: env.SHOPIFY_APP_SCOPES,
      });

      await enqueueOrderBackfill(db, provisioned.storeId, provisioned.syncRunId);
      await enqueueProductCatalogSync(db, provisioned.storeId, provisioned.syncRunId);
      void runOrderBackfillNow(db);
      void runProductCatalogNow(db);
      void runPayoutSyncNow(db, provisioned.storeId);

      const connectToken = issueConnectToken({
        userId: provisioned.userId,
        orgId: provisioned.orgId,
        storeId: provisioned.storeId,
        shopDomain: provisioned.shopDomain,
      });

      if (pending.platform === "mobile") {
        return redirectMobile(reply, "onboarding", {
          shopify: "connected",
          connect_token: connectToken,
        });
      }

      return reply.send({
        status: "connected",
        connect_token: connectToken,
        shop_domain: provisioned.shopDomain,
      });
    } catch (err) {
      request.log.error({ err }, "Shopify OAuth callback failed");

      if (err instanceof ShopifyOAuthError) {
        return redirectMobileError(reply, err.code);
      }

      if (err instanceof Error && err.message === "missing_shop_email") {
        return redirectMobileError(reply, "missing_shop_email");
      }

      return redirectMobileError(reply, "server_error");
    }
  });

  app.post("/api/v1/auth/shopify/token-exchange", async (request, reply) => {
    const parsed = tokenExchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { connect_token, session_token, shop_domain } = parsed.data;

    if (connect_token) {
      const session = consumeConnectToken(connect_token);
      if (!session) {
        return reply.status(401).send({
          error: SHOPIFY_OAUTH_ERROR_MESSAGES.invalid_state,
          code: "invalid_connect_token",
        });
      }

      return reply.send(
        await issueJwtPair({
          sub: session.userId,
          org_id: session.orgId,
          store_ids: [session.storeId],
          shop_domain: session.shopDomain,
        }),
      );
    }

    // Dev fallback when OAuth is not configured
    if (!session_token || session_token === "invalid") {
      return reply.status(401).send({ error: "Invalid Shopify session token" });
    }

    const claims = {
      sub: STUB_USER_ID,
      org_id: STUB_ORG_ID,
      store_ids: [STUB_STORE_ID],
      shop_domain: shop_domain ?? "stub-store.myshopify.com",
    };

    return reply.send(await issueJwtPair(claims));
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request" });
    }

    try {
      const payload = await verifyToken(parsed.data.refresh_token);
      if (payload.type !== "refresh") {
        return reply.status(401).send({ error: "Not a refresh token" });
      }

      const claims = {
        sub: payload.sub,
        org_id: payload.org_id,
        store_ids: payload.store_ids,
        shop_domain: payload.shop_domain,
      };

      const access_token = await signAccessToken(claims);
      return reply.send({ access_token, token_type: "Bearer", expires_in: 900 });
    } catch {
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }
  });

  app.get("/api/v1/auth/me", { preHandler: requireAuth }, async (request) => {
    return {
      user_id: request.auth!.sub,
      org_id: request.auth!.org_id,
      store_ids: request.auth!.store_ids,
      shop_domain: request.auth!.shop_domain,
    };
  });
}
