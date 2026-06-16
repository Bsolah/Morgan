import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto.js";

describe("credential encryption", () => {
  it("round-trips secrets", () => {
    const key = "test-encryption-key-for-unit-tests";
    const encrypted = encryptSecret('{"access_token":"secret"}', key);
    expect(encrypted.startsWith("morgan:v1:")).toBe(true);
    expect(decryptSecret(encrypted, key)).toBe('{"access_token":"secret"}');
  });
});
