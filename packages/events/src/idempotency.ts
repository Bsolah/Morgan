import type { IdempotencyStore } from "../types.js";

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly keys = new Map<string, number>();

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    this.prune();
    if (this.keys.has(key)) return false;
    this.keys.set(key, Date.now() + ttlSeconds * 1000);
    return true;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.keys) {
      if (expiresAt <= now) this.keys.delete(key);
    }
  }

  clear(): void {
    this.keys.clear();
  }
}

type RedisClient = {
  set(key: string, value: string, options: { NX: boolean; EX: number }): Promise<string | null>;
  quit(): Promise<string>;
};

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: RedisClient, private readonly prefix = "morgan:idempotency:") {}

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(`${this.prefix}${key}`, "1", { NX: true, EX: ttlSeconds });
    return result === "OK";
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export async function createIdempotencyStore(
  redisUrl: string | undefined,
  fallback: InMemoryIdempotencyStore,
): Promise<IdempotencyStore> {
  if (!redisUrl) return fallback;

  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: redisUrl });
    await client.connect();
    return new RedisIdempotencyStore(client as unknown as RedisClient);
  } catch {
    return fallback;
  }
}
