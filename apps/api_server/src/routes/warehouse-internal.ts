import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import { enqueueGoldRefreshRequest } from "../lib/warehouse-refresh-service.js";
import {
  refreshMetricSnapshotsForAllStores,
  refreshMetricSnapshotsForStore,
} from "../lib/metric-snapshot-service.js";
import {
  generateDailyBriefing,
  generateDueDailyBriefings,
} from "../lib/briefing-generation-service.js";

const refreshBodySchema = z.object({
  store_id: z.string().uuid(),
  trigger: z.enum(["chat", "manual"]).default("chat"),
});

const snapshotRefreshBodySchema = z.object({
  store_id: z.string().uuid().optional(),
});

const briefingGenerateBodySchema = z.object({
  store_id: z.string().uuid().optional(),
  force: z.boolean().default(false),
});

export async function registerWarehouseInternalRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/internal/warehouse/refresh-gold", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const body = refreshBodySchema.parse(request.body ?? {});
    const queued = await enqueueGoldRefreshRequest({
      storeId: body.store_id,
      trigger: body.trigger,
      redisUrl: env.REDIS_URL,
      filesystemSignalPath: env.WAREHOUSE_CHAT_REFRESH_SIGNAL_PATH,
    });

    return reply.status(202).send({
      status: "queued",
      request_id: queued.request_id,
      store_id: queued.store_id,
      trigger: queued.trigger,
    });
  });

  app.post("/api/v1/internal/warehouse/refresh-metric-snapshots", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = snapshotRefreshBodySchema.parse(request.body ?? {});

    if (body.store_id) {
      const result = await refreshMetricSnapshotsForStore(db, body.store_id);
      return reply.send({ status: "refreshed", results: [result] });
    }

    const results = await refreshMetricSnapshotsForAllStores(db);
    return reply.send({ status: "refreshed", results });
  });

  app.post("/api/v1/internal/briefing/generate", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = briefingGenerateBodySchema.parse(request.body ?? {});

    if (body.store_id) {
      const result = await generateDailyBriefing(db, body.store_id, { force: body.force });
      return reply.send({ status: "generated", results: result ? [result] : [] });
    }

    const generatedCount = await generateDueDailyBriefings(db);
    return reply.send({ status: "generated", generated_count: generatedCount });
  });
}
