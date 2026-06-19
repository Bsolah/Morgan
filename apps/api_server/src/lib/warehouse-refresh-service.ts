import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type GoldRefreshTrigger = "chat" | "manual";

export type GoldRefreshRequest = {
  request_id: string;
  store_id: string;
  trigger: GoldRefreshTrigger;
  requested_at: string;
};

export async function enqueueGoldRefreshRequest(options: {
  storeId: string;
  trigger: GoldRefreshTrigger;
  redisUrl?: string;
  filesystemSignalPath?: string;
}): Promise<GoldRefreshRequest> {
  const request: GoldRefreshRequest = {
    request_id: randomUUID(),
    store_id: options.storeId,
    trigger: options.trigger,
    requested_at: new Date().toISOString(),
  };

  if (options.redisUrl) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: options.redisUrl });
      await client.connect();
      await client.rPush("warehouse:gold_refresh:pending", JSON.stringify(request));
      await client.quit();
      return request;
    } catch {
      // Fall through to filesystem signal.
    }
  }

  const signalPath = options.filesystemSignalPath ?? "./data/warehouse/chat_refresh.pending";
  await mkdir(path.dirname(signalPath), { recursive: true });
  await writeFile(signalPath, JSON.stringify(request, null, 2), "utf8");
  return request;
}
