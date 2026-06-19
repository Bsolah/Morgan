import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import {
  deleteSkuLeadTimeOverride,
  getInventoryConfig,
  InventoryConfigError,
  updateInventoryConfig,
  upsertSkuLeadTimeOverride,
} from "../lib/inventory-config-service.js";
import { getInventoryHealth, getInventorySkuDetail } from "../lib/inventory-health-service.js";

function canAccessStore(request: { auth?: { store_ids: string[] } }, storeId: string): boolean {
  return request.auth?.store_ids.includes(storeId) ?? false;
}

function resolveStoreId(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

const windowSchema = z.object({
  window_days: z.coerce.number().min(7).max(90).default(30),
});

const updateInventoryConfigSchema = z.object({
  default_lead_time_days: z.number().int().min(1).max(365),
});

const upsertSkuLeadTimeSchema = z.object({
  lead_time_days: z.number().int().min(1).max(365),
});

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/inventory/config", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return reply.send(await getInventoryConfig(db, storeId));
  });

  app.patch("/api/v1/inventory/config", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const parsed = updateInventoryConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return reply.send(await updateInventoryConfig(db, storeId, parsed.data));
    } catch (err) {
      if (err instanceof InventoryConfigError) {
        return reply.status(400).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.put(
    "/api/v1/inventory/lead-times/:sku",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = resolveStoreId(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session", code: "no_store" });
      }

      const { sku } = request.params as { sku: string };
      const parsed = upsertSkuLeadTimeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        return reply.send(
          await upsertSkuLeadTimeOverride(db, storeId, {
            sku: decodeURIComponent(sku),
            lead_time_days: parsed.data.lead_time_days,
          }),
        );
      } catch (err) {
        if (err instanceof InventoryConfigError) {
          return reply.status(400).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/v1/inventory/lead-times/:sku",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = resolveStoreId(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session", code: "no_store" });
      }

      const { sku } = request.params as { sku: string };
      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        return reply.send(await deleteSkuLeadTimeOverride(db, storeId, decodeURIComponent(sku)));
      } catch (err) {
        if (err instanceof InventoryConfigError) {
          return reply.status(400).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    },
  );

  app.get(
    "/api/v1/stores/:store_id/inventory/health",
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
        return await getInventoryHealth(db, storeId, parsed.data.window_days);
      } catch (error) {
        request.log.error(error, "Failed to load inventory health");
        return reply.status(503).send({ error: "Inventory health unavailable", code: "not_ready" });
      }
    },
  );

  app.get(
    "/api/v1/stores/:store_id/inventory/skus/:sku",
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
        const detail = await getInventorySkuDetail(
          db,
          storeId,
          decodeURIComponent(sku),
          parsed.data.window_days,
        );
        if (!detail) {
          return reply.status(404).send({ error: "SKU not found", code: "not_found" });
        }
        return detail;
      } catch (error) {
        request.log.error(error, "Failed to load inventory SKU detail");
        return reply.status(503).send({ error: "Inventory SKU unavailable", code: "not_ready" });
      }
    },
  );
}
