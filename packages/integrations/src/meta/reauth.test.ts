import { describe, expect, it } from "vitest";
import {
  META_TOKEN_EXPIRED_MESSAGE,
  isMetaTokenReauthRequired,
  resolveMetaIntegrationErrorMessage,
} from "./reauth.js";

describe("meta reauth helpers", () => {
  it("detects token reauth when refresh failures exceed threshold", () => {
    expect(isMetaTokenReauthRequired({ status: "error", refreshFailureCount: 2 })).toBe(true);
    expect(isMetaTokenReauthRequired({ status: "error", refreshFailureCount: 1 })).toBe(false);
    expect(isMetaTokenReauthRequired({ status: "connected", refreshFailureCount: 3 })).toBe(false);
  });

  it("returns human-readable token expired message", () => {
    expect(
      resolveMetaIntegrationErrorMessage({
        status: "error",
        refreshFailureCount: 2,
        lastError: "Meta token refresh failed",
      }),
    ).toEqual({
      needsReauth: true,
      errorMessage: META_TOKEN_EXPIRED_MESSAGE,
    });
  });

  it("passes through last error when reauth is not required", () => {
    expect(
      resolveMetaIntegrationErrorMessage({
        status: "connected",
        refreshFailureCount: 0,
        lastError: "Insights sync failed",
      }),
    ).toEqual({
      needsReauth: false,
      errorMessage: "Insights sync failed",
    });
  });
});
