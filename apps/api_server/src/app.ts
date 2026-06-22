import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { financeRoutes } from "./routes/finance.js";
import { cashRoutes } from "./routes/cash.js";
import { syncRoutes } from "./routes/sync.js";
import { storeRoutes } from "./routes/stores.js";
import { shopifyWebhookRoutes } from "./routes/webhooks/shopify.js";
import { shopifyComplianceWebhookRoutes } from "./routes/webhooks/shopify-compliance.js";
import { plaidWebhookRoutes } from "./routes/webhooks/plaid.js";
import { complianceRoutes } from "./routes/compliance.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { marketingRoutes } from "./routes/marketing.js";
import {
  plaidIntegrationRoutes,
  registerIntegrationsHub,
} from "./routes/plaid-integrations.js";
import { quickbooksIntegrationRoutes } from "./routes/quickbooks-integrations.js";
import { xeroIntegrationRoutes } from "./routes/xero-integrations.js";
import { googleAdsIntegrationRoutes } from "./routes/google-ads-integrations.js";
import { registerWarehouseInternalRoutes } from "./routes/warehouse-internal.js";
import { registerEventProcessingInternalRoutes } from "./routes/event-processing-internal.js";
import { sqlAgentRoutes } from "./routes/sql-agent.js";
import { metricsRoutes } from "./routes/metrics.js";
import { profitRoutes } from "./routes/profit.js";
import { inventoryRoutes } from "./routes/inventory.js";
import { chatRoutes } from "./routes/chat.js";
import { alertsRoutes } from "./routes/alerts.js";
import { recommendationsRoutes } from "./routes/recommendations.js";
import { scenariosRoutes } from "./routes/scenarios.js";
import { pricingRoutes } from "./routes/pricing.js";
import { notificationsRoutes } from "./routes/notifications.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, { origin: true });

  // Preserve raw body for Shopify HMAC verification
  app.addHook("preParsing", async (request, _reply, payload) => {
    const routeConfig = request.routeOptions.config as { rawBody?: boolean } | undefined;
    if (!routeConfig?.rawBody) return payload;

    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);
    request.rawBody = rawBody;
    const { Readable } = await import("node:stream");
    return Readable.from(rawBody);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(financeRoutes);
  await app.register(cashRoutes);
  await app.register(syncRoutes);
  await app.register(storeRoutes);
  await app.register(shopifyWebhookRoutes);
  await app.register(shopifyComplianceWebhookRoutes);
  await app.register(plaidWebhookRoutes);
  await app.register(complianceRoutes);
  await app.register(integrationsRoutes);
  await app.register(plaidIntegrationRoutes);
  await app.register(quickbooksIntegrationRoutes);
  await app.register(xeroIntegrationRoutes);
  await app.register(googleAdsIntegrationRoutes);
  await registerIntegrationsHub(app);
  await app.register(marketingRoutes);
  await registerWarehouseInternalRoutes(app);
  await registerEventProcessingInternalRoutes(app);
  await app.register(sqlAgentRoutes);
  await app.register(metricsRoutes);
  await app.register(profitRoutes);
  await app.register(inventoryRoutes);
  await app.register(alertsRoutes);
  await app.register(recommendationsRoutes);
  await app.register(scenariosRoutes);
  await app.register(pricingRoutes);
  await app.register(notificationsRoutes);
  await app.register(chatRoutes);

  return app;
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}
