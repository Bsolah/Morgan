import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("metrics routes", () => {
  it("GET /api/v1/stores/:store_id/metrics requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/metrics",
    });

    expect(res.statusCode).toBe(401);
  });
});
