import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const PREFIX = "morgan:v1:";
const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function getKey(secret: string): Buffer {
  if (!cachedKey) {
    cachedKey = scryptSync(secret, "morgan.credentials.v1", 32);
  }
  return cachedKey;
}

export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(encryptionKey), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string, encryptionKey: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv(ALGO, getKey(encryptionKey), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}
