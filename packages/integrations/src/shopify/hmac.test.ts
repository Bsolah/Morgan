import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyWebhookHmac } from "./hmac.js";

describe("verifyShopifyWebhookHmac", () => {
  const secret = "test-shopify-secret";
  const body = Buffer.from(JSON.stringify({ id: 123, total_price: "10.00" }));

  function sign(buf: Buffer): string {
    return createHmac("sha256", secret).update(buf).digest("base64");
  }

  it("accepts valid HMAC", () => {
    expect(verifyShopifyWebhookHmac(body, sign(body), secret)).toBe(true);
  });

  it("rejects invalid HMAC", () => {
    expect(verifyShopifyWebhookHmac(body, "bad-signature", secret)).toBe(false);
  });

  it("rejects tampered body", () => {
    const tampered = Buffer.from(JSON.stringify({ id: 999 }));
    expect(verifyShopifyWebhookHmac(tampered, sign(body), secret)).toBe(false);
  });
});
