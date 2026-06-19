import { describe, expect, it } from "vitest";
import { resolveComplianceTopic } from "./shopify-compliance-service.js";

describe("resolveComplianceTopic", () => {
  it("resolves topics from headers", () => {
    expect(resolveComplianceTopic("app/uninstalled", "/webhooks/shopify/compliance")).toBe(
      "app/uninstalled",
    );
    expect(resolveComplianceTopic("customers/data_request", "/webhooks/shopify/compliance")).toBe(
      "customers/data_request",
    );
  });

  it("resolves topics from dedicated compliance paths", () => {
    expect(
      resolveComplianceTopic(undefined, "/webhooks/shopify/customers/data_request"),
    ).toBe("customers/data_request");
    expect(resolveComplianceTopic(undefined, "/webhooks/shopify/customers/redact")).toBe(
      "customers/redact",
    );
    expect(resolveComplianceTopic(undefined, "/webhooks/shopify/shop/redact")).toBe("shop/redact");
  });
});
