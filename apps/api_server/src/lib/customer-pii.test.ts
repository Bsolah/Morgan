import { describe, expect, it } from "vitest";
import {
  customerEmailMatches,
  customerIdMatches,
  payloadMatchesCustomer,
  redactWebhookPayload,
} from "./customer-pii.js";

describe("customer PII helpers", () => {
  it("matches customer id in order payloads", () => {
    const payload = {
      id: 1001,
      customer: { id: 42, email: "buyer@example.com" },
    };

    expect(customerIdMatches(payload, 42)).toBe(true);
    expect(payloadMatchesCustomer(payload, { id: 42 })).toBe(true);
  });

  it("redacts customer fields in webhook payloads", () => {
    const redacted = redactWebhookPayload({
      id: 1001,
      email: "buyer@example.com",
      customer: { id: 42, email: "buyer@example.com", first_name: "Grace" },
      billing_address: { city: "Austin" },
    });

    expect(redacted.email).toBe("[REDACTED]");
    expect(redacted.customer).toMatchObject({ id: 42, redacted: true });
    expect(redacted.billing_address).toEqual({ redacted: true });
    expect(redacted._pii_redacted_at).toEqual(expect.any(String));
  });

  it("matches customer email case-insensitively", () => {
    expect(customerEmailMatches({ email: "Buyer@Example.com" }, "buyer@example.com")).toBe(true);
  });
});
