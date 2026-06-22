import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getScenario, listScenarios, saveScenario } from "../lib/scenario-service.js";
import {
  getAdSpendScenarioBaselines,
  runAdSpendScenarioForStore,
} from "../lib/ad-spend-scenario-service.js";
import { runInventoryPurchaseScenarioForStore } from "../lib/inventory-purchase-scenario-service.js";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

const channelChangeSchema = z.object({
  channel: z.enum(["meta", "google"]),
  spend_change_pct: z.number().min(-100).max(200),
});

const runScenarioSchema = z.object({
  channel_changes: z.array(channelChangeSchema).min(1),
  assumption_overrides: z.record(z.coerce.number()).optional(),
  save: z.boolean().optional(),
  source: z.enum(["chat", "scenario_planner"]).optional(),
});

const runInventoryPurchaseSchema = z.object({
  sku: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unit_cost_usd: z.number().positive(),
  save: z.boolean().optional(),
  source: z.enum(["chat", "scenario_planner"]).optional(),
});

const saveAdSpendScenarioSchema = z.object({
  scenario_type: z.literal("ad_spend"),
  channel: z.string().min(1),
  spend_change_pct: z.number(),
  title: z.string().min(1),
  inputs: z.record(z.unknown()),
  results: z.record(z.unknown()),
  source: z.string().optional(),
  chat_message_id: z.string().uuid().optional(),
});

const saveInventoryPurchaseScenarioSchema = z.object({
  scenario_type: z.literal("inventory_purchase"),
  title: z.string().min(1),
  inputs: z.record(z.unknown()),
  results: z.record(z.unknown()),
  source: z.string().optional(),
  chat_message_id: z.string().uuid().optional(),
});

const saveScenarioSchema = z.discriminatedUnion("scenario_type", [
  saveAdSpendScenarioSchema,
  saveInventoryPurchaseScenarioSchema,
]);

const scenarioParamsSchema = z.object({
  scenario_id: z.string().uuid(),
});

export async function scenariosRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/scenarios/baselines", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return await getAdSpendScenarioBaselines(db, storeId);
    } catch (error) {
      request.log.error(error, "Failed to load scenario baselines");
      return reply.status(503).send({ error: "Scenario baselines unavailable", code: "not_ready" });
    }
  });

  app.post("/api/v1/scenarios/run", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const body = runScenarioSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid scenario run payload" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      const result = await runAdSpendScenarioForStore(db, storeId, body.data);
      if (result.scenarios.length === 0) {
        return reply.status(400).send({
          error: "No connected ad channel with spend data for this scenario",
          code: "no_baseline",
        });
      }
      return result;
    } catch (error) {
      request.log.error(error, "Failed to run ad spend scenario");
      return reply.status(503).send({ error: "Scenario run unavailable", code: "not_ready" });
    }
  });

  app.post("/api/v1/scenarios/inventory/run", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const body = runInventoryPurchaseSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid inventory purchase scenario payload" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return await runInventoryPurchaseScenarioForStore(db, storeId, body.data);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_inventory_purchase_input") {
        return reply.status(400).send({ error: "Invalid inventory purchase inputs", code: "invalid_input" });
      }
      request.log.error(error, "Failed to run inventory purchase scenario");
      return reply.status(503).send({ error: "Scenario run unavailable", code: "not_ready" });
    }
  });

  app.get("/api/v1/scenarios", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const items = await listScenarios(db, storeId);
    return { items };
  });

  app.get(
    "/api/v1/scenarios/:scenario_id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const params = scenarioParamsSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid scenario id" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const scenario = await getScenario(db, storeId, params.data.scenario_id);
      if (!scenario) {
        return reply.status(404).send({ error: "Scenario not found", code: "not_found" });
      }

      return scenario;
    },
  );

  app.post("/api/v1/scenarios", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const body = saveScenarioSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid scenario payload" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const scenario = await saveScenario(db, storeId, body.data);
    return reply.status(201).send({ scenario });
  });
}
