import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "../lib/jwt.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid Authorization header" });
  }

  try {
    const token = header.slice("Bearer ".length);
    request.auth = await verifyToken(token);
  } catch {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: Awaited<ReturnType<typeof verifyToken>>;
  }
}
