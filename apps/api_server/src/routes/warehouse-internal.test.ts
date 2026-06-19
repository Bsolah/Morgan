import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { env } from "../config.js";

describe("warehouse internal routes", () => {
  it("POST /api/v1/internal/warehouse/refresh-gold requires internal key", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/internal/warehouse/refresh-gold",
      payload: { store_id: "00000000-0000-4000-8000-000000000002" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("queues on-demand gold refresh when internal key is valid", async () => {
    if (!env.COMPLIANCE_INTERNAL_KEY) return;

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/internal/warehouse/refresh-gold",
      headers: { "x-compliance-internal-key": env.COMPLIANCE_INTERNAL_KEY },
      payload: {
        store_id: "00000000-0000-4000-8000-000000000002",
        trigger: "chat",
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({
      status: "queued",
      store_id: "00000000-0000-4000-8000-000000000002",
      trigger: "chat",
    });
  });
});
