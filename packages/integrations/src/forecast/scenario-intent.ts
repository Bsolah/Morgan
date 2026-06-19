export type ScenarioChannel = "meta" | "google";

export type ParsedScenarioIntent = {
  channel: ScenarioChannel;
  spendChangePct: number;
};

const SCENARIO_PREFIX = /\b(what if|what happens if|what would happen if|if i)\b/i;

const META_CHANNEL = /\b(meta|facebook|fb)\b/i;
const GOOGLE_CHANNEL = /\b(google)\b/i;

const SPEND_CHANGE =
  /\b(increase|decrease|cut|reduce|raise|boost|scale|grow|lower)\b[^.?]{0,40}?(\d{1,3})\s*%/i;

const SPEND_CHANGE_ALT =
  /\bby\s+(\d{1,3})\s*%[^.?]{0,40}?\b(increase|decrease|cut|reduce|raise|boost|scale|grow|lower)\b/i;

const SPEND_CHANGE_TRAILING =
  /(\d{1,3})\s*%\s*(increase|decrease|cut|reduce|raise|boost|scale|grow|lower)\b/i;

function parseDirection(word: string): number {
  const normalized = word.toLowerCase();
  if (/(decrease|cut|reduce|lower)/.test(normalized)) return -1;
  return 1;
}

export function parseScenarioIntent(message: string): ParsedScenarioIntent | null {
  const trimmed = message.trim();
  if (!SCENARIO_PREFIX.test(trimmed)) return null;
  if (!/\b(spend|budget|ad\s|ads)\b/i.test(trimmed)) return null;

  let match = trimmed.match(SPEND_CHANGE);
  let direction = 1;
  let pct = 0;

  if (match) {
    direction = parseDirection(match[1] ?? "increase");
    pct = Number(match[2]);
  } else {
    match = trimmed.match(SPEND_CHANGE_ALT);
    if (match) {
      pct = Number(match[1]);
      direction = parseDirection(match[2] ?? "increase");
    } else {
      match = trimmed.match(SPEND_CHANGE_TRAILING);
      if (!match) return null;
      pct = Number(match[1]);
      direction = parseDirection(match[2] ?? "increase");
    }
  }

  if (!Number.isFinite(pct) || pct <= 0 || pct > 200) return null;

  let channel: ScenarioChannel = "meta";
  if (GOOGLE_CHANNEL.test(trimmed) && !META_CHANNEL.test(trimmed)) {
    channel = "google";
  }

  return {
    channel,
    spendChangePct: direction * pct,
  };
}

export function isScenarioQuestion(message: string): boolean {
  return parseScenarioIntent(message) != null;
}
