import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildShopifyAuthorizeUrl,
  isValidShopDomain,
  normalizeShopInput,
  verifyShopifyOAuthHmac,
} from "./oauth.js";

describe("shopify oauth helpers", () => {
  it("normalizes shop input", () => {
    expect(normalizeShopInput("MyStore")).toBe("mystore.myshopify.com");
    expect(normalizeShopInput("https://demo.myshopify.com/admin")).toBe("demo.myshopify.com");
  });

  it("validates shop domains", () => {
    expect(isValidShopDomain("demo.myshopify.com")).toBe(true);
    expect(isValidShopDomain("invalid")).toBe(false);
  });

  it("builds authorize URL", () => {
    const url = buildShopifyAuthorizeUrl({
      shopDomain: "demo.myshopify.com",
      clientId: "client-id",
      scopes: "read_orders",
      redirectUri: "http://localhost:8080/callback",
      state: "abc123",
    });
    expect(url).toContain("demo.myshopify.com/admin/oauth/authorize");
    expect(url).toContain("client_id=client-id");
    expect(url).toContain("state=abc123");
  });

  it("verifies oauth hmac", () => {
    const secret = "test-secret";
    const query = {
      code: "auth-code",
      shop: "demo.myshopify.com",
      state: "state123",
      timestamp: "1234567890",
      hmac: "placeholder",
    };

    const params = Object.entries(query)
      .filter(([key]) => key !== "hmac")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    const digest = createHmac("sha256", secret).update(params).digest("hex");
    expect(verifyShopifyOAuthHmac({ ...query, hmac: digest }, secret)).toBe(true);
    expect(verifyShopifyOAuthHmac({ ...query, hmac: "bad" }, secret)).toBe(false);
  });
});
