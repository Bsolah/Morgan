import type { FastifyInstance } from "fastify";
import { getDb } from "../lib/db.js";
import { enqueueOrderBackfill, getSyncStatus } from "../lib/order-backfill-service.js";
import { runOrderBackfillNow } from "../lib/order-backfill-runner.js";
import { requireAuth } from "../plugins/auth.js";

function resolveStoreId(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

export async function syncRoutes(app: FastifyInstance) {
  app.get("/api/v1/sync/status", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return reply.send(await getSyncStatus(db, storeId));
  });

  app.post("/api/v1/sync/resume", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const jobId = await enqueueOrderBackfill(db, storeId);
    void runOrderBackfillNow(db);

    return reply.send({
      status: "resumed",
      job_id: jobId,
      ...(await getSyncStatus(db, storeId)),
    });
  });
}
