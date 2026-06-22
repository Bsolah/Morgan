import type { FastifyInstance } from "fastify";

import { z } from "zod";

import { requireAuth } from "../plugins/auth.js";

import { getDb } from "../lib/db.js";

import { getDailyBrief, getBriefForDate, listBriefingHistory } from "../lib/brief-service.js";

import { getBriefingHistoryForDate } from "../lib/briefing-regeneration-service.js";

import { merchantLocalDay, BUDGET_REALLOCATION_WINDOW_DAYS } from "@morgan/integrations";

import { loadStoreBriefingConfig } from "../lib/briefing-generation-service.js";

import { getMarketingOverview, getCampaignDetail } from "../lib/poas-service.js";
import { getMarketingMer } from "../lib/marketing-mer-service.js";

import { getMarketingBudgetAllocation } from "../lib/marketing-budget-allocation-service.js";

import { getAttributionRules } from "../lib/attribution-rules-service.js";



function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {

  return request.auth?.store_ids[0] ?? null;

}



const windowSchema = z.object({
  window_days: z.coerce.number().min(1).max(90).default(7),
});

const budgetAllocationQuerySchema = z.object({
  window_days: z.coerce.number().min(1).max(90).default(BUDGET_REALLOCATION_WINDOW_DAYS),
});



const campaignDetailQuerySchema = z.object({

  window_days: z.coerce.number().min(1).max(90).default(7),

  trend_days: z.coerce.number().min(7).max(90).default(30),

});



const briefDateParamsSchema = z.object({

  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

});



const briefHistoryQuerySchema = z.object({

  days: z.coerce.number().min(1).max(90).default(30),

});



export async function marketingRoutes(app: FastifyInstance) {

  app.get("/api/v1/brief/today", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    try {

      return await getDailyBrief(db, storeId);

    } catch (error) {

      request.log.error(error, "Failed to build daily brief");

      return reply.status(503).send({ error: "Brief unavailable", code: "not_ready" });

    }

  });



  app.get("/api/v1/brief/today/versions", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    const config = await loadStoreBriefingConfig(db, storeId);

    const briefingDate = merchantLocalDay(config?.timezone ?? "UTC");

    const history = await getBriefingHistoryForDate(db, storeId, briefingDate);

    if (!history) {

      return reply.status(404).send({ error: "Brief not found", code: "not_found" });

    }



    return history;

  });



  app.get("/api/v1/brief/history", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const parsed = briefHistoryQuerySchema.safeParse(request.query ?? {});

    if (!parsed.success) {

      return reply.status(400).send({ error: "Invalid days parameter" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    return listBriefingHistory(db, storeId, parsed.data.days);

  });



  app.get("/api/v1/brief/:date", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const parsed = briefDateParamsSchema.safeParse(request.params ?? {});

    if (!parsed.success) {

      return reply.status(400).send({ error: "Invalid date" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    const brief = await getBriefForDate(db, storeId, parsed.data.date);

    if (!brief) {

      return reply.status(404).send({ error: "Brief not found", code: "not_found" });

    }



    return brief;

  });



  app.get("/api/v1/brief/:date/versions", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const parsed = briefDateParamsSchema.safeParse(request.params ?? {});

    if (!parsed.success) {

      return reply.status(400).send({ error: "Invalid date" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    const history = await getBriefingHistoryForDate(db, storeId, parsed.data.date);

    if (!history) {

      return reply.status(404).send({ error: "Brief not found", code: "not_found" });

    }



    return history;

  });



  app.get("/api/v1/marketing/overview", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

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

      return await getMarketingOverview(db, storeId, parsed.data.window_days);

    } catch (error) {

      request.log.error(error, "Failed to load marketing overview");

      return reply.status(503).send({ error: "Marketing data unavailable", code: "not_ready" });

    }

  });



  app.get("/api/v1/marketing/mer", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const parsed = z

      .object({

        window_days: z.coerce.number().min(1).max(90).default(30),

        trend_days: z.coerce.number().min(7).max(90).default(30),

      })

      .safeParse(request.query);



    if (!parsed.success) {

      return reply.status(400).send({ error: "Invalid query parameters" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    try {

      return await getMarketingMer(db, storeId, parsed.data.window_days, parsed.data.trend_days);

    } catch (error) {

      request.log.error(error, "Failed to load marketing MER");

      return reply.status(503).send({ error: "Marketing MER unavailable", code: "not_ready" });

    }

  });



  app.get(

    "/api/v1/marketing/campaigns/:channel/:campaign_id",

    { preHandler: requireAuth },

    async (request, reply) => {

      const storeId = storeIdFromAuth(request);

      if (!storeId) {

        return reply.status(400).send({ error: "No store in session" });

      }



      const { channel, campaign_id: campaignId } = request.params as {

        channel: string;

        campaign_id: string;

      };



      const parsed = campaignDetailQuerySchema.safeParse(request.query);

      if (!parsed.success) {

        return reply.status(400).send({ error: "Invalid query parameters" });

      }



      const db = getDb();

      if (!db) {

        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

      }



      try {

        const detail = await getCampaignDetail(

          db,

          storeId,

          decodeURIComponent(channel),

          decodeURIComponent(campaignId),

          parsed.data.window_days,

          parsed.data.trend_days,

        );

        if (!detail) {

          return reply.status(404).send({ error: "Campaign not found", code: "not_found" });

        }

        return detail;

      } catch (error) {

        request.log.error(error, "Failed to load campaign detail");

        return reply.status(503).send({ error: "Campaign data unavailable", code: "not_ready" });

      }

    },

  );



  app.get("/api/v1/marketing/budget-allocation", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const parsed = budgetAllocationQuerySchema.safeParse(request.query);

    if (!parsed.success) {

      return reply.status(400).send({ error: "Invalid window_days" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    try {

      return await getMarketingBudgetAllocation(db, storeId, parsed.data.window_days);

    } catch (error) {

      request.log.error(error, "Failed to load marketing budget allocation");

      return reply.status(503).send({ error: "Budget allocation data unavailable", code: "not_ready" });

    }

  });



  app.get("/api/v1/marketing/attribution-rules", { preHandler: requireAuth }, async (request, reply) => {

    const storeId = storeIdFromAuth(request);

    if (!storeId) {

      return reply.status(400).send({ error: "No store in session" });

    }



    const db = getDb();

    if (!db) {

      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });

    }



    const rules = await getAttributionRules(db, storeId);

    return { rules };

  });

}

