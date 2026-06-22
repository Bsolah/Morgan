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
import {
  runProfitLeakScanForStore,
  scanDueProfitLeakScans,
} from "../lib/profit-leak-scan-service.js";
import {
  refreshDueRevenueForecasts,
  refreshRevenueForecastForStore,
} from "../lib/revenue-forecast-service.js";
import {
  refreshDueSkuDemandForecasts,
  refreshSkuDemandForecastForStore,
} from "../lib/sku-demand-forecast-service.js";
import { generateRecommendationCandidatesForStore } from "../lib/recommendation-candidate-service.js";
import { rankAndPromoteRecommendationCandidates } from "../lib/recommendation-ranking-service.js";
import {
  sendDueWeeklyEmailDigests,
  sendWeeklyEmailDigest,
} from "../lib/weekly-email-digest-service.js";

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

const emailDigestBodySchema = z.object({
  store_id: z.string().uuid().optional(),
  force: z.boolean().default(false),
});

const leakScanBodySchema = z.object({
  store_id: z.string().uuid().optional(),
  force: z.boolean().default(false),
});

const revenueForecastBodySchema = z.object({
  store_id: z.string().uuid().optional(),
  force: z.boolean().default(false),
});

const skuDemandForecastBodySchema = z.object({
  store_id: z.string().uuid().optional(),
  force: z.boolean().default(false),
});

const recommendationCandidatesBodySchema = z.object({
  store_id: z.string().uuid(),
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

  app.post("/api/v1/internal/email-digest/send", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = emailDigestBodySchema.parse(request.body ?? {});

    if (body.store_id) {
      const result = await sendWeeklyEmailDigest(db, body.store_id, { force: body.force });
      return reply.send({ status: "processed", results: [result] });
    }

    const sentCount = await sendDueWeeklyEmailDigests(db);
    return reply.send({ status: "processed", sent_count: sentCount });
  });

  app.post("/api/v1/internal/profit-leaks/scan", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = leakScanBodySchema.parse(request.body ?? {});

    if (body.store_id) {
      const result = await runProfitLeakScanForStore(db, body.store_id, { force: body.force });
      return reply.send({ status: "scanned", results: [result] });
    }

    const results = await scanDueProfitLeakScans(db, { force: body.force });
    return reply.send({ status: "scanned", results });
  });

  app.post("/api/v1/internal/forecasts/revenue/refresh", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = revenueForecastBodySchema.parse(request.body ?? {});

    if (body.store_id) {
      const result = await refreshRevenueForecastForStore(db, body.store_id, { force: body.force });
      return reply.send({ status: "refreshed", results: [result] });
    }

    const results = await refreshDueRevenueForecasts(db, { force: body.force });
    return reply.send({ status: "refreshed", results });
  });

  app.post("/api/v1/internal/forecasts/sku-demand/refresh", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = skuDemandForecastBodySchema.parse(request.body ?? {});

    if (body.store_id) {
      const result = await refreshSkuDemandForecastForStore(db, body.store_id, { force: body.force });
      return reply.send({ status: "refreshed", results: [result] });
    }

    const results = await refreshDueSkuDemandForecasts(db, { force: body.force });
    return reply.send({ status: "refreshed", results });
  });

  app.post("/api/v1/internal/recommendations/candidates/generate", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = recommendationCandidatesBodySchema.parse(request.body ?? {});
    const result = await generateRecommendationCandidatesForStore(db, body.store_id);
    return reply.send({ status: "generated", result });
  });

  app.post("/api/v1/internal/recommendations/rank", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const db = (await import("../lib/db.js")).getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const body = recommendationCandidatesBodySchema.parse(request.body ?? {});
    const result = await rankAndPromoteRecommendationCandidates(db, body.store_id);
    return reply.send({ status: "ranked", result });
  });
}
