import { and, asc, eq } from "drizzle-orm";
import { chatSessionMessages, chatSessions, users, type Database } from "@morgan/db";
import {
  synthesizeChatResponse,
  enrichChatSynthesisResult,
  enforceChatCitationGuardrail,
  detectOutOfScopeChatRequest,
  buildOutOfScopeChatRefusal,
  attachChatActionCard,
  runForecastAgent,
  isScenarioQuestion,
} from "@morgan/integrations";
import { buildChatDataContext } from "./chat-data-service.js";
import { streamChatSynthesis, type PersistedChatMessage } from "./chat-sse.js";

export async function createChatSession(
  db: Database,
  storeId: string,
  userId?: string | null,
): Promise<{ session_id: string; created_at: string }> {
  let resolvedUserId: string | null = null;
  if (userId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    resolvedUserId = user?.id ?? null;
  }

  const [row] = await db
    .insert(chatSessions)
    .values({
      storeId,
      userId: resolvedUserId,
    })
    .returning();

  return {
    session_id: row!.id,
    created_at: row!.createdAt.toISOString(),
  };
}

export async function getChatSession(
  db: Database,
  storeId: string,
  sessionId: string,
): Promise<typeof chatSessions.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.storeId, storeId)))
    .limit(1);

  return row ?? null;
}

export async function listChatMessages(
  db: Database,
  storeId: string,
  sessionId: string,
): Promise<PersistedChatMessage[]> {
  const rows = await db
    .select()
    .from(chatSessionMessages)
    .where(
      and(eq(chatSessionMessages.sessionId, sessionId), eq(chatSessionMessages.storeId, storeId)),
    )
    .orderBy(asc(chatSessionMessages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    citations: (row.citations ?? []) as PersistedChatMessage["citations"],
    confidence: (row.confidence as PersistedChatMessage["confidence"]) ?? null,
    follow_ups: row.followUps ?? [],
    action_card: (row.actionCard as PersistedChatMessage["action_card"]) ?? null,
    scenario_card: (row.scenarioCard as PersistedChatMessage["scenario_card"]) ?? null,
    created_at: row.createdAt.toISOString(),
  }));
}

export async function sendChatMessageStream(
  db: Database,
  storeId: string,
  sessionId: string,
  content: string,
  reply: import("fastify").FastifyReply,
): Promise<void> {
  const session = await getChatSession(db, storeId, sessionId);
  if (!session) {
    reply.status(404).send({ error: "Chat session not found", code: "not_found" });
    return;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    reply.status(400).send({ error: "Message cannot be empty" });
    return;
  }

  await db.insert(chatSessionMessages).values({
    sessionId,
    storeId,
    role: "user",
    content: trimmed,
  });

  const outOfScope = detectOutOfScopeChatRequest(trimmed);
  let synthesis;
  if (outOfScope) {
    synthesis = buildOutOfScopeChatRefusal(outOfScope);
  } else {
    const context = await buildChatDataContext(db, storeId, trimmed);
    const scenarioResult = isScenarioQuestion(trimmed) ? runForecastAgent(trimmed, context) : null;

    if (scenarioResult) {
      synthesis = enforceChatCitationGuardrail(enrichChatSynthesisResult(scenarioResult, context));
    } else {
      synthesis = enforceChatCitationGuardrail(
        attachChatActionCard(
          enrichChatSynthesisResult(synthesizeChatResponse(context), context),
          context,
        ),
      );
    }
  }

  await streamChatSynthesis(reply, synthesis, {
    onComplete: async (fullText) => {
      const [assistantRow] = await db
        .insert(chatSessionMessages)
        .values({
          sessionId,
          storeId,
          role: "assistant",
          content: fullText,
          citations: synthesis.citations,
          confidence: synthesis.confidence,
          followUps: synthesis.follow_ups,
          actionCard: synthesis.action_card ?? null,
          scenarioCard: synthesis.scenario_card ?? null,
        })
        .returning({ id: chatSessionMessages.id });

      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));

      return assistantRow!.id;
    },
  });
}
