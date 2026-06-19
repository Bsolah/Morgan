import { describe, expect, it } from "vitest";
import {
  QUICKBOOKS_ACCOUNTING_SCOPE,
  buildQuickBooksAuthorizeUrl,
  isQuickBooksReauthRequired,
  shouldPromptQuickBooksReauth,
} from "./oauth.js";

describe("quickbooks oauth helpers", () => {
  it("builds authorize URL with accounting scope", () => {
    const url = buildQuickBooksAuthorizeUrl({
      clientId: "intuit-client-id",
      redirectUri: "http://localhost:8080/api/v1/integrations/quickbooks/oauth/callback",
      state: "state123",
    });

    expect(url).toContain("appcenter.intuit.com/connect/oauth2");
    expect(url).toContain("client_id=intuit-client-id");
    expect(url).toContain("state=state123");
    expect(url).toContain(encodeURIComponent(QUICKBOOKS_ACCOUNTING_SCOPE));
    expect(url).toContain("response_type=code");
  });

  it("prompts reauth within 7 days of the 90-day limit", () => {
    const authorizedAt = new Date("2025-01-01T00:00:00.000Z");
    const day83 = new Date("2025-03-25T00:00:00.000Z");
    const day91 = new Date("2025-04-02T00:00:00.000Z");

    expect(shouldPromptQuickBooksReauth(authorizedAt, day83)).toBe(true);
    expect(isQuickBooksReauthRequired(authorizedAt, day83)).toBe(false);
    expect(isQuickBooksReauthRequired(authorizedAt, day91)).toBe(true);
  });
});
