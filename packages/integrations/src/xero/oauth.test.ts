import { describe, expect, it } from "vitest";
import { buildXeroAuthorizeUrl, XERO_ACCOUNTING_SCOPES } from "./oauth.js";
import { defaultMorganCategoryForXeroAccount } from "./account-mapping.js";

describe("xero oauth", () => {
  it("builds authorize url with accounting scopes", () => {
    const url = buildXeroAuthorizeUrl({
      clientId: "client-id",
      redirectUri: "http://localhost:8080/callback",
      state: "abc123",
    });

    expect(url).toContain("login.xero.com/identity/connect/authorize");
    expect(url).toContain(encodeURIComponent("accounting.transactions"));
    expect(url).toContain(encodeURIComponent("offline_access"));
    expect(XERO_ACCOUNTING_SCOPES).toContain("accounting.reports.read");
  });
});

describe("xero account mapping", () => {
  it("maps direct costs accounts to cogs", () => {
    expect(
      defaultMorganCategoryForXeroAccount({
        AccountID: "1",
        Name: "Materials",
        Type: "DIRECTCOSTS",
      }),
    ).toBe("cogs");
  });
});
