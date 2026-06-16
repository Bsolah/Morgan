import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  hmacHeader: string,
  clientSecret: string,
): boolean {
  if (!hmacHeader || !clientSecret) return false;

  const computed = createHmac("sha256", clientSecret).update(rawBody).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}
