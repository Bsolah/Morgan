import type { FastifyReply } from "fastify";
import type {
  ChatCitation,
  ChatConfidence,
  ChatSynthesisWithAction,
  ChatSynthesisWithScenario,
} from "@morgan/integrations";

export type ChatStreamSynthesis = ChatSynthesisWithAction & ChatSynthesisWithScenario;

export type ChatStreamHandlers = {
  onComplete: (fullText: string) => Promise<string>;
};

export function writeSseEvent(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function streamChatSynthesis(
  reply: FastifyReply,
  result: ChatStreamSynthesis,
  handlers: ChatStreamHandlers,
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  writeSseEvent(reply, "meta", {
    confidence: result.confidence,
    follow_ups: result.follow_ups,
  });

  const chunks = chunkForStreaming(result.answer);
  let fullText = "";

  for (const chunk of chunks) {
    fullText += chunk;
    writeSseEvent(reply, "token", { text: chunk });
  }

  for (const citation of result.citations) {
    writeSseEvent(reply, "citation", {
      source: citation.source_table,
      source_table: citation.source_table,
      source_label: "source_label" in citation ? citation.source_label : citation.source_table.replace(/^mart_/, ""),
      date: citation.source_date,
      source_date: citation.source_date,
      metric: citation.metric ?? null,
      query_summary: "query_summary" in citation ? citation.query_summary : null,
      raw_values: "raw_values" in citation ? citation.raw_values : null,
      data_as_of: "data_as_of" in citation ? citation.data_as_of : null,
      is_stale: "is_stale" in citation ? citation.is_stale : false,
    });
  }

  if (result.action_card) {
    writeSseEvent(reply, "action", result.action_card);
  }

  if (result.scenario_card) {
    writeSseEvent(reply, "scenario", result.scenario_card);
  }

  const messageId = await handlers.onComplete(fullText);
  writeSseEvent(reply, "done", { message_id: messageId });
  reply.raw.end();
}

function chunkForStreaming(text: string): string[] {
  const parts = text.match(/\S+\s*|\s+/g) ?? [text];
  return parts.length > 0 ? parts : [text];
}

export type PersistedChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  confidence: ChatConfidence | null;
  follow_ups: string[];
  action_card: Record<string, unknown> | null;
  scenario_card: Record<string, unknown> | null;
  created_at: string;
};
