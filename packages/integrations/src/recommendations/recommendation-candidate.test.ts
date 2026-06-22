import { describe, expect, it } from "vitest";
import {
  buildSimilarityHash,
  dedupeRecommendationCandidates,
  isWithinCandidateDedupeWindow,
  RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS,
  type RecommendationCandidate,
} from "./recommendation-candidate.js";

function candidate(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    engine: "leak",
    category: "ad_waste",
    title: "Pause Campaign X",
    body: "POAS below 1",
    impact_low: 100,
    impact_high: 150,
    confidence: "high",
    effort: "low",
    evidence: [{ campaign_id: "cmp-1" }],
    expires_at: "2026-06-20T23:59:59.000Z",
    similarity_hash: "ad_waste:campaign:cmp-1",
    ...overrides,
  };
}

describe("recommendation candidate dedupe", () => {
  it("builds normalized similarity hashes from category and subject", () => {
    expect(buildSimilarityHash("inventory_reorder", "TEE-BLUE-M")).toBe(
      "inventory_reorder:tee-blue-m",
    );
  });

  it("treats dedupe window as 7 days inclusive of reference day", () => {
    expect(
      isWithinCandidateDedupeWindow(
        "2026-06-13T10:00:00.000Z",
        "2026-06-19",
        RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS,
      ),
    ).toBe(true);
    expect(
      isWithinCandidateDedupeWindow(
        "2026-06-11T10:00:00.000Z",
        "2026-06-19",
        RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS,
      ),
    ).toBe(false);
  });

  it("drops candidates with same SKU and category seen in the last 7 days", () => {
    const incoming = [
      candidate({ similarity_hash: "ad_waste:campaign:cmp-1" }),
      candidate({
        title: "Another campaign",
        similarity_hash: "ad_waste:campaign:cmp-2",
      }),
    ];

    const deduped = dedupeRecommendationCandidates(
      incoming,
      [{ similarity_hash: "ad_waste:campaign:cmp-1", created_at: "2026-06-17T00:00:00.000Z" }],
      "2026-06-19",
    );

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.similarity_hash).toBe("ad_waste:campaign:cmp-2");
  });

  it("dedupes duplicate hashes within the same batch", () => {
    const deduped = dedupeRecommendationCandidates(
      [
        candidate(),
        candidate({ title: "Duplicate" }),
      ],
      [],
      "2026-06-19",
    );

    expect(deduped).toHaveLength(1);
  });
});
