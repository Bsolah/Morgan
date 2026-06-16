import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { storeRoutes } from "./routes/stores.js";
import { shopifyWebhookRoutes } from "./routes/webhooks/shopify.js";

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
  await app.register(storeRoutes);
  await app.register(shopifyWebhookRoutes);

  return app;
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}
