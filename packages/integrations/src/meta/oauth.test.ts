import { describe, expect, it } from "vitest";
import { META_ADS_SCOPES, buildMetaAuthorizeUrl } from "./oauth.js";

describe("meta oauth helpers", () => {
  it("builds authorize URL with ads_read scope", () => {
    const url = buildMetaAuthorizeUrl({
      appId: "meta-app-id",
      redirectUri: "http://localhost:8080/api/v1/integrations/meta/oauth/callback",
      state: "state123",
    });

    expect(url).toContain("facebook.com");
    expect(url).toContain("client_id=meta-app-id");
    expect(url).toContain("state=state123");
    expect(url).toContain(`scope=${META_ADS_SCOPES.join("%2C")}`);
    expect(url).toContain("response_type=code");
  });
});
