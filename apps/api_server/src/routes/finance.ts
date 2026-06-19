import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import {
  COGS_METHODS,
  FinanceConfigError,
  getFinanceConfig,
  updateFinanceConfig,
} from "../lib/finance-config-service.js";
import { requireAuth } from "../plugins/auth.js";

const updateFinanceConfigSchema = z
  .object({
    cogs_method: z.enum(COGS_METHODS),
    manual_cogs_pct: z.number().min(0).max(100).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.cogs_method === "manual_pct" && value.manual_cogs_pct == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "manual_cogs_pct is required when cogs_method is manual_pct",
        path: ["manual_cogs_pct"],
      });
    }
  });

function resolveStoreId(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

export async function financeRoutes(app: FastifyInstance) {
  app.get("/api/v1/finance/config", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return reply.send(await getFinanceConfig(db, storeId));
  });

  app.patch("/api/v1/finance/config", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = resolveStoreId(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session", code: "no_store" });
    }

    const parsed = updateFinanceConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      const config = await updateFinanceConfig(db, storeId, parsed.data);
      return reply.send(config);
    } catch (err) {
      if (err instanceof FinanceConfigError) {
        return reply.status(400).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
