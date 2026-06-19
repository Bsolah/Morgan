import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { getPlaidBaseUrl, plaidRequest, type PlaidEnvironment } from "@morgan/integrations";

type PlaidWebhookVerificationKey = {
  alg: string;
  crv?: string;
  kid: string;
  kty: string;
  use: string;
  x?: string;
  y?: string;
  created_at: number;
  expired_at: number | null;
};

const keyCache = new Map<string, PlaidWebhookVerificationKey>();

export type PlaidWebhookPayload = {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: { error_code?: string; error_message?: string } | null;
  new_transactions?: number;
  removed_transactions?: number;
};

async function fetchPlaidWebhookVerificationKey(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  keyId: string;
}): Promise<PlaidWebhookVerificationKey> {
  const cached = keyCache.get(opts.keyId);
  if (cached) return cached;

  const baseUrl = getPlaidBaseUrl(opts.environment);
  const response = await plaidRequest<{ key: PlaidWebhookVerificationKey }>(
    baseUrl,
    "/webhook_verification_key/get",
    {
      client_id: opts.clientId,
      secret: opts.secret,
      key_id: opts.keyId,
    },
  );

  keyCache.set(opts.keyId, response.key);
  return response.key;
}

function constantTimeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function verifyPlaidWebhook(opts: {
  verificationHeader: string;
  rawBody: Buffer;
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
}): Promise<PlaidWebhookPayload> {
  const header = decodeProtectedHeader(opts.verificationHeader);
  if (!header.kid || header.alg !== "ES256") {
    throw new Error("invalid_plaid_verification_header");
  }

  const key = await fetchPlaidWebhookVerificationKey({
    clientId: opts.clientId,
    secret: opts.secret,
    environment: opts.environment,
    keyId: header.kid,
  });

  const jwk = await importJWK(
    {
      kty: key.kty,
      crv: key.crv,
      x: key.x,
      y: key.y,
      alg: key.alg,
    },
    key.alg,
  );

  const { payload } = await jwtVerify(opts.verificationHeader, jwk, {
    maxTokenAge: "5 min",
  });

  const claimedBodyHash = payload.request_body_sha256;
  if (typeof claimedBodyHash !== "string") {
    throw new Error("missing_request_body_hash");
  }

  const actualBodyHash = createHash("sha256").update(opts.rawBody).digest("hex");
  if (!constantTimeCompare(claimedBodyHash, actualBodyHash)) {
    throw new Error("plaid_webhook_body_hash_mismatch");
  }

  return JSON.parse(opts.rawBody.toString("utf8")) as PlaidWebhookPayload;
}

export function isPlaidTransactionsWebhook(payload: PlaidWebhookPayload): boolean {
  if (payload.webhook_type !== "TRANSACTIONS") return false;
  return [
    "SYNC_UPDATES_AVAILABLE",
    "DEFAULT_UPDATE",
    "INITIAL_UPDATE",
    "HISTORICAL_UPDATE",
    "TRANSACTIONS_REMOVED",
  ].includes(payload.webhook_code);
}
