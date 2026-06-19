import { describe, expect, it } from "vitest";
import {
  buildOutOfScopeChatRefusal,
  detectOutOfScopeChatRequest,
  OUT_OF_SCOPE_REFUSAL_ANSWER,
} from "./chat-scope-guardrail.js";
import { CHAT_SCOPE_GOLDEN_SET } from "./chat-scope-guardrail.golden.js";

describe("buildOutOfScopeChatRefusal", () => {
  it("uses the required refusal message and in-scope redirects", () => {
    const refusal = buildOutOfScopeChatRefusal("tax");

    expect(refusal.answer).toBe(OUT_OF_SCOPE_REFUSAL_ANSWER);
    expect(refusal.citations).toEqual([]);
    expect(refusal.confidence).toBe("high");
    expect(refusal.follow_ups.length).toBeGreaterThanOrEqual(2);
  });
});

describe("chat scope guardrail golden set", () => {
  it("handles 100% of golden-set prompts correctly", () => {
    const failures: string[] = [];

    for (const testCase of CHAT_SCOPE_GOLDEN_SET) {
      const actual = detectOutOfScopeChatRequest(testCase.prompt);
      if (actual !== testCase.expected) {
        failures.push(`${testCase.id}: expected ${testCase.expected}, got ${actual}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  for (const testCase of CHAT_SCOPE_GOLDEN_SET) {
    it(`${testCase.id}: ${testCase.expected ?? "in-scope"}`, () => {
      expect(detectOutOfScopeChatRequest(testCase.prompt)).toBe(testCase.expected);
    });
  }
});
