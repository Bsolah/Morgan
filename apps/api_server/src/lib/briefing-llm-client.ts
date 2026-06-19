import {
  BRIEFING_NARRATIVE_MAX_WORDS,
  clampHeadline,
  clampNarrative,
  composeTemplateBrief,
  countWords,
  extractNumericTokens,
  metricValuesWithinTolerance,
  parseBriefingLlmOutput,
  type BriefingKpiDelta,
  type BriefingLlmOutput,
  type BriefingTopAction,
} from "@morgan/integrations";
import { env } from "../config.js";

type NarrativeContext = {
  briefingDate: string;
  kpiDeltas: BriefingKpiDelta[];
  topAction: BriefingTopAction;
  metaConnected: boolean;
  metrics: Record<string, number>;
  allowedNumbers: number[];
};

const BRIEFING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "narrative"],
  properties: {
    headline: { type: "string", maxLength: 140 },
    narrative: { type: "string" },
    highlights: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
  },
} as const;

function buildLlmPrompt(context: NarrativeContext): string {
  const metricLines = context.kpiDeltas
    .map(
      (delta) =>
        `- ${delta.label}: ${delta.value} (prior ${delta.prior_value}, delta ${delta.delta_pct}%)`,
    )
    .join("\n");

  return [
    "Write a concise daily financial briefing for a Shopify merchant.",
    "Use ONLY the numeric values provided below. Do not invent numbers.",
    `Briefing date: ${context.briefingDate}`,
    "KPI deltas:",
    metricLines,
    `Top action: ${context.topAction.title} — ${context.topAction.body}`,
    `Headline max ${140} characters. Narrative max ${BRIEFING_NARRATIVE_MAX_WORDS} words.`,
    "Return JSON with keys: headline, narrative, highlights (optional string array).",
  ].join("\n");
}

function validateNarrativeOutput(
  output: BriefingLlmOutput,
  allowedNumbers: number[],
): BriefingLlmOutput | null {
  const headline = clampHeadline(output.headline);
  const narrative = clampNarrative(output.narrative);

  if (countWords(narrative) > BRIEFING_NARRATIVE_MAX_WORDS) return null;

  const narrativeNumbers = extractNumericTokens(narrative);
  if (!metricValuesWithinTolerance(narrativeNumbers, allowedNumbers)) return null;

  return { headline, narrative, highlights: output.highlights };
}

async function callBriefingLlm(context: NarrativeContext): Promise<BriefingLlmOutput | null> {
  if (!env.BRIEFING_LLM_API_URL || !env.BRIEFING_LLM_API_KEY) return null;

  const response = await fetch(`${env.BRIEFING_LLM_API_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.BRIEFING_LLM_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.BRIEFING_LLM_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "daily_briefing",
          strict: true,
          schema: BRIEFING_JSON_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are Morgan, a financial copilot for ecommerce merchants. Output valid JSON only.",
        },
        { role: "user", content: buildLlmPrompt(context) },
      ],
    }),
    signal: AbortSignal.timeout(env.BRIEFING_LLM_TIMEOUT_MS),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const output = parseBriefingLlmOutput(parsed);
  if (!output) return null;

  return validateNarrativeOutput(output, context.allowedNumbers);
}

export async function generateBriefingNarrative(
  context: NarrativeContext,
): Promise<{ output: BriefingLlmOutput; source: "llm" | "template" }> {
  try {
    const llmOutput = await callBriefingLlm(context);
    if (llmOutput) {
      return { output: llmOutput, source: "llm" };
    }
  } catch {
    // Fall back to deterministic template narrative.
  }

  return {
    output: composeTemplateBrief(context),
    source: "template",
  };
}

export type BriefingLlmClient = typeof generateBriefingNarrative;
