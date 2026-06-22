import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getProfitSkuDetail, getProfitSkuRanking } from "../lib/sku-economics-service.js";
import { getProfitDaySummary, getProfitOverview, getMarginDrivers } from "../lib/profit-overview-service.js";
import { getProfitLeakDetail, listActiveProfitLeaks } from "../lib/profit-leak-service.js";
import { getRevenueForecast } from "../lib/revenue-forecast-service.js";

function canAccessStore(request: { auth?: { store_ids: string[] } }, storeId: string): boolean {
  return request.auth?.store_ids.includes(storeId) ?? false;
}

const windowSchema = z.object({
  window_days: z.coerce.number().min(7).max(90).default(30),
});

const dayParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const leakParamsSchema = z.object({
  leak_id: z.string().uuid(),
});

export async function profitRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/stores/:store_id/profit/overview", { preHandler: requireAuth }, async (request, reply) => {
    const { store_id: storeId } = request.params as { store_id: string };

    if (!canAccessStore(request, storeId)) {
      return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
    }

    const parsed = windowSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid window_days" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return await getProfitOverview(db, storeId, parsed.data.window_days);
    } catch (error) {
      request.log.error(error, "Failed to load profit overview");
      return reply.status(503).send({ error: "Profit overview unavailable", code: "not_ready" });
    }
  });

  app.get(
    "/api/v1/stores/:store_id/profit/margin-drivers",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { store_id: storeId } = request.params as { store_id: string };

      if (!canAccessStore(request, storeId)) {
        return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
      }

      const parsed = windowSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid window_days" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        return await getMarginDrivers(db, storeId, parsed.data.window_days);
      } catch (error) {
        request.log.error(error, "Failed to load margin drivers");
        return reply.status(503).send({ error: "Margin drivers unavailable", code: "not_ready" });
      }
    },
  );

  app.get("/api/v1/stores/:store_id/profit/leaks", { preHandler: requireAuth }, async (request, reply) => {
    const { store_id: storeId } = request.params as { store_id: string };

    if (!canAccessStore(request, storeId)) {
      return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return await listActiveProfitLeaks(db, storeId);
    } catch (error) {
      request.log.error(error, "Failed to load profit leaks");
      return reply.status(503).send({ error: "Profit leaks unavailable", code: "not_ready" });
    }
  });

  app.get(
    "/api/v1/stores/:store_id/profit/leaks/:leak_id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { store_id: storeId, leak_id: leakId } = request.params as { store_id: string; leak_id: string };

      if (!canAccessStore(request, storeId)) {
        return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
      }

      const parsed = leakParamsSchema.safeParse({ leak_id: leakId });
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid leak id" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        const leak = await getProfitLeakDetail(db, storeId, parsed.data.leak_id);
        if (!leak) {
          return reply.status(404).send({ error: "Leak not found", code: "not_found" });
        }
        return leak;
      } catch (error) {
        request.log.error(error, "Failed to load profit leak detail");
        return reply.status(503).send({ error: "Profit leak unavailable", code: "not_ready" });
      }
    },
  );

  app.get(
    "/api/v1/stores/:store_id/profit/days/:date",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { store_id: storeId, date } = request.params as { store_id: string; date: string };

      if (!canAccessStore(request, storeId)) {
        return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
      }

      const parsed = dayParamsSchema.safeParse({ date });
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid date" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        const summary = await getProfitDaySummary(db, storeId, parsed.data.date);
        if (!summary) {
          return reply.status(404).send({ error: "Day not found", code: "not_found" });
        }
        return summary;
      } catch (error) {
        request.log.error(error, "Failed to load profit day summary");
        return reply.status(503).send({ error: "Profit day summary unavailable", code: "not_ready" });
      }
    },
  );

  app.get("/api/v1/stores/:store_id/profit/skus", { preHandler: requireAuth }, async (request, reply) => {
    const { store_id: storeId } = request.params as { store_id: string };

    if (!canAccessStore(request, storeId)) {
      return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
    }

    const parsed = windowSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid window_days" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return await getProfitSkuRanking(db, storeId, parsed.data.window_days);
    } catch (error) {
      request.log.error(error, "Failed to load profit SKU ranking");
      return reply.status(503).send({ error: "Profit data unavailable", code: "not_ready" });
    }
  });

  app.get(
    "/api/v1/stores/:store_id/profit/skus/:sku",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { store_id: storeId, sku } = request.params as { store_id: string; sku: string };

      if (!canAccessStore(request, storeId)) {
        return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
      }

      const parsed = windowSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid window_days" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        const detail = await getProfitSkuDetail(db, storeId, decodeURIComponent(sku), parsed.data.window_days);
        if (!detail) {
          return reply.status(404).send({ error: "SKU not found", code: "not_found" });
        }
        return detail;
      } catch (error) {
        request.log.error(error, "Failed to load profit SKU detail");
        return reply.status(503).send({ error: "Profit data unavailable", code: "not_ready" });
      }
    },
  );

  app.get(
    "/api/v1/stores/:store_id/profit/forecast/revenue",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { store_id: storeId } = request.params as { store_id: string };

      if (!canAccessStore(request, storeId)) {
        return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        return await getRevenueForecast(db, storeId);
      } catch (error) {
        request.log.error(error, "Failed to load revenue forecast");
        return reply.status(503).send({ error: "Revenue forecast unavailable", code: "not_ready" });
      }
    },
  );
}
