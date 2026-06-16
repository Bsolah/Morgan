import type { FastifyInstance } from "fastify";
import { checkPostgres, checkRedis } from "../lib/db.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "morgan-api",
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);
    const ready = postgres && redis;

    const body = {
      status: ready ? "ready" : "degraded",
      checks: {
        postgres,
        redis,
      },
      timestamp: new Date().toISOString(),
    };

    return reply.status(ready ? 200 : 503).send(body);
  });
}
