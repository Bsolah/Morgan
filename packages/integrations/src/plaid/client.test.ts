import { describe, expect, it } from "vitest";
import {
  getPlaidBaseUrl,
  pickPreferredBusinessAccount,
  PLAID_PRIVACY_DISCLOSURE,
  PLAID_SUPPORTED_ACCOUNT_SUBTYPES,
} from "./client.js";

describe("plaid client helpers", () => {
  it("uses sandbox base URL", () => {
    expect(getPlaidBaseUrl("sandbox")).toBe("https://sandbox.plaid.com");
  });

  it("includes privacy disclosure copy", () => {
    expect(PLAID_PRIVACY_DISCLOSURE).toContain("never move money");
  });

  it("supports checking and savings subtypes", () => {
    expect(PLAID_SUPPORTED_ACCOUNT_SUBTYPES).toEqual(["checking", "savings"]);
  });

  it("prefers checking account when available", () => {
    const account = pickPreferredBusinessAccount([
      {
        account_id: "1",
        name: "Savings",
        mask: "1234",
        type: "depository",
        subtype: "savings",
      },
      {
        account_id: "2",
        name: "Operating",
        mask: "5678",
        type: "depository",
        subtype: "checking",
      },
    ]);

    expect(account?.account_id).toBe("2");
  });
});
