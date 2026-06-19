import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { getPayoutStatus } from "../lib/payout-sync-service.js";
import {
  getCashOverview,
  getUnmatchedCashTransactions,
  manualLinkPayoutDeposit,
  unlinkPayoutDepositMatch,
} from "../lib/payout-match-service.js";
import { getUncategorizedTransactions } from "../lib/plaid-transaction-sync-service.js";
import { getCashRunway } from "../lib/cash-runway-service.js";
import { requireAuth } from "../plugins/auth.js";

const linkMatchSchema = z.object({
  shopify_payout_id: z.string().uuid(),
  plaid_transaction_id: z.string().uuid(),
});

const unlinkMatchSchema = z.object({
  match_id: z.string().uuid(),
});

function resolveStoreId(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

export async function cashRoutes(app: FastifyInstance) {
  app.get("/api/v1/cash/payouts", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return reply.send(await getPayoutStatus(db, storeId));
  });

  app.get("/api/v1/cash/overview", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return reply.send(await getCashOverview(db, storeId));
    } catch (error) {
      request.log.error(error, "Failed to load cash overview");
      return reply.status(503).send({ error: "Cash overview unavailable", code: "not_ready" });
    }
  });

  app.get("/api/v1/cash/unmatched", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return reply.send(await getUnmatchedCashTransactions(db, storeId));
    } catch (error) {
      request.log.error(error, "Failed to load unmatched cash transactions");
      return reply.status(503).send({ error: "Unmatched transactions unavailable", code: "not_ready" });
    }
  });

  app.get("/api/v1/cash/runway", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return reply.send(await getCashRunway(db, storeId));
    } catch (error) {
      request.log.error(error, "Failed to load cash runway");
      return reply.status(503).send({ error: "Cash runway unavailable", code: "not_ready" });
    }
  });

  app.post("/api/v1/cash/matches/link", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const parsed = linkMatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid match payload", code: "invalid_payload" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return reply.send(
        await manualLinkPayoutDeposit(
          db,
          storeId,
          parsed.data.shopify_payout_id,
          parsed.data.plaid_transaction_id,
          request.auth?.sub,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "link_failed";
      if (message === "match_entities_not_found") {
        return reply.status(404).send({ error: "Payout or deposit not found", code: "not_found" });
      }
      throw error;
    }
  });

  app.post("/api/v1/cash/matches/unlink", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const parsed = unlinkMatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid unlink payload", code: "invalid_payload" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return reply.send(
        await unlinkPayoutDepositMatch(db, storeId, parsed.data.match_id, request.auth?.sub),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unlink_failed";
      if (message === "match_not_found") {
        return reply.status(404).send({ error: "Match not found", code: "not_found" });
      }
      throw error;
    }
  });

  app.get("/api/v1/cash/transactions/uncategorized", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return reply.send(await getUncategorizedTransactions(db, storeId));
  });
}
