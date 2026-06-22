import { leakBody, leakTitle } from "../../finance/profit-leak-copy.js";
import {
  buildCandidateImpact,
  buildSimilarityHash,
  candidateExpiresAt,
  leakSeverityToConfidence,
  leakTypeToEffort,
  similaritySubjectForLeak,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

export type ProfitLeakCandidateInput = {
  id: string;
  leak_type: string;
  external_key: string;
  severity: string;
  amount_at_risk_usd: number | null;
  evidence: Array<Record<string, unknown>> | null;
};

export function buildLeakEngineCandidates(
  leaks: ProfitLeakCandidateInput[],
  referenceDay: string,
): RecommendationCandidate[] {
  return leaks
    .filter((leak) => leak.leak_type !== "dead_stock")
    .map((leak) => {
    const subject = similaritySubjectForLeak({
      leak_type: leak.leak_type,
      external_key: leak.external_key,
      evidence: leak.evidence,
    });
    const impact = buildCandidateImpact(leak.amount_at_risk_usd);
    const sku =
      typeof leak.evidence?.[0]?.sku === "string" ? (leak.evidence[0].sku as string) : null;

    return {
      engine: "leak",
      category: leak.leak_type,
      title: leakTitle(leak.leak_type, leak.evidence),
      body: leakBody(leak.leak_type, leak.evidence),
      impact_low: impact.impact_low,
      impact_high: impact.impact_high,
      confidence: leakSeverityToConfidence(leak.severity),
      effort: leakTypeToEffort(leak.leak_type),
      evidence: leak.evidence ?? [],
      expires_at: candidateExpiresAt(referenceDay),
      similarity_hash: buildSimilarityHash(leak.leak_type, subject),
      subject_sku: sku,
      source_key: leak.id,
    };
  });
}
