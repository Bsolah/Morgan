import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/jwt.js";
import { requireAuth } from "../plugins/auth.js";

const tokenExchangeSchema = z.object({
  session_token: z.string().min(1),
  shop_domain: z.string().min(3).optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// Stub identity used until full Shopify OAuth is wired
const STUB_ORG_ID = "00000000-0000-4000-8000-000000000001";
const STUB_STORE_ID = "00000000-0000-4000-8000-000000000002";
const STUB_USER_ID = "00000000-0000-4000-8000-000000000003";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/shopify/token-exchange", async (request, reply) => {
    const parsed = tokenExchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { session_token, shop_domain } = parsed.data;

    // Stub: accept any non-empty session token for local/mobile dev
    if (session_token === "invalid") {
      return reply.status(401).send({ error: "Invalid Shopify session token" });
    }

    const claims = {
      sub: STUB_USER_ID,
      org_id: STUB_ORG_ID,
      store_ids: [STUB_STORE_ID],
      shop_domain: shop_domain ?? "stub-store.myshopify.com",
    };

    const [access_token, refresh_token] = await Promise.all([
      signAccessToken(claims),
      signRefreshToken(claims),
    ]);

    return reply.send({
      access_token,
      refresh_token,
      token_type: "Bearer",
      expires_in: 900,
      store_id: STUB_STORE_ID,
      shop_domain: claims.shop_domain,
    });
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

  // Shopify OAuth install callback stub
  app.get("/api/v1/auth/shopify/callback", async (request, reply) => {
    const query = request.query as { shop?: string; code?: string };
    if (!query.shop || !query.code) {
      return reply.status(400).send({ error: "Missing shop or code" });
    }

    return reply.send({
      status: "stub",
      message: "OAuth callback received — full install flow not yet implemented",
      shop: query.shop,
    });
  });
}
