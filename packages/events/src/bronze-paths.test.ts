import { describe, expect, it } from "vitest";
import {
  bronzeObjectKey,
  iterateDatesInclusive,
  parseBronzeObjectKey,
  quarantineObjectKey,
} from "./bronze-paths.js";

describe("bronze paths", () => {
  it("builds bronze object keys", () => {
    expect(
      bronzeObjectKey(
        "shopify",
        "00000000-0000-4000-8000-000000000001",
        "2026-06-17",
        "550e8400-e29b-41d4-a716-446655440001",
      ),
    ).toBe(
      "shopify/00000000-0000-4000-8000-000000000001/2026-06-17/550e8400-e29b-41d4-a716-446655440001.json",
    );
  });

  it("builds quarantine object keys", () => {
    expect(
      quarantineObjectKey(
        2,
        "shopify",
        "00000000-0000-4000-8000-000000000001",
        "2026-06-17",
        "550e8400-e29b-41d4-a716-446655440001",
      ),
    ).toBe(
      "quarantine/2/shopify/00000000-0000-4000-8000-000000000001/2026-06-17/550e8400-e29b-41d4-a716-446655440001.json",
    );
  });

  it("parses bronze and quarantine keys", () => {
    const bronzeKey =
      "shopify/00000000-0000-4000-8000-000000000001/2026-06-17/550e8400-e29b-41d4-a716-446655440001.json";
    expect(parseBronzeObjectKey(bronzeKey)).toMatchObject({
      source: "shopify",
      quarantined: false,
    });

    const quarantineKey =
      "quarantine/2/shopify/00000000-0000-4000-8000-000000000001/2026-06-17/550e8400-e29b-41d4-a716-446655440001.json";
    expect(parseBronzeObjectKey(quarantineKey)).toMatchObject({
      schema_version: 2,
      quarantined: true,
    });
  });

  it("iterates inclusive date ranges", () => {
    expect([...iterateDatesInclusive("2026-06-15", "2026-06-17")]).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
    ]);
  });
});
