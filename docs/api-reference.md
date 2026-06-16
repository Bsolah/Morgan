# API Reference

Base URL: `http://localhost:8080` (dev)

All JSON APIs use `Content-Type: application/json` unless noted.

## Health

### `GET /health`

Liveness probe. Always returns 200 if the process is running.

```json
{
  "status": "ok",
  "service": "morgan-api",
  "timestamp": "2026-06-15T10:00:00.000Z"
}
```

### `GET /ready`

Readiness probe. Returns 200 when Postgres and Redis are reachable; 503 otherwise.

```json
{
  "status": "ready",
  "checks": { "postgres": true, "redis": true },
  "timestamp": "2026-06-15T10:00:00.000Z"
}
```

---

## Authentication

### `GET /api/v1/auth/shopify/oauth/start`

Starts Shopify OAuth for mobile or web. Redirects to Shopify consent screen.

**Query params:**

| Param | Required | Description |
|-------|----------|-------------|
| `shop` | Yes | Store domain or handle (`mystore` → `mystore.myshopify.com`) |
| `platform` | No | `mobile` (default redirect: `morgan://onboarding`) or `web` |

**Response:** `302` redirect to `https://{shop}/admin/oauth/authorize`

### `GET /api/v1/auth/shopify/callback`

Shopify OAuth callback. Exchanges code, provisions org/store/integration, then redirects:

- **Mobile:** `morgan://onboarding?shopify=connected&connect_token=...`
- **Error:** `morgan://onboarding?shopify_error=token_exchange_failed`

Requires `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `ENCRYPTION_KEY`.

### `POST /api/v1/auth/shopify/token-exchange`

Exchange a one-time `connect_token` (from OAuth callback) or dev `session_token` for Morgan JWTs.

**Request (production):**

```json
{
  "connect_token": "<from deep link>"
}
```

**Request (local dev fallback):**

```json
{
  "session_token": "stub-session",
  "shop_domain": "demo.myshopify.com"
}
```

**Response `200`:**

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900,
  "store_id": "00000000-0000-4000-8000-000000000002",
  "shop_domain": "demo.myshopify.com"
}
```

### `POST /api/v1/auth/refresh`

**Request:**

```json
{ "refresh_token": "<jwt>" }
```

**Response `200`:**

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### `GET /api/v1/auth/me`

Requires `Authorization: Bearer <access_token>`.

**Response `200`:**

```json
{
  "user_id": "00000000-0000-4000-8000-000000000003",
  "org_id": "00000000-0000-4000-8000-000000000001",
  "store_ids": ["00000000-0000-4000-8000-000000000002"],
  "shop_domain": "demo.myshopify.com"
}
```


## Webhooks

### `POST /webhooks/shopify`

Shopify Admin API webhook receiver.

**Headers (required):**

| Header | Description |
|--------|-------------|
| `X-Shopify-Hmac-Sha256` | Base64 HMAC-SHA256 of raw body |
| `X-Shopify-Topic` | e.g. `orders/create` |
| `X-Shopify-Shop-Domain` | `store.myshopify.com` |
| `X-Shopify-Webhook-Id` | Optional UUID for idempotency |

**Body:** Raw JSON (not re-serialized — HMAC is over exact bytes).

**Response:**

| Status | Meaning |
|--------|---------|
| `200` | Accepted — `{ "received": true, "event_id": "..." }` |
| `401` | Missing/invalid HMAC |
| `400` | Invalid JSON or missing raw body |
| `500` | `SHOPIFY_API_SECRET` not configured |

Events are written to bronze storage and published to in-memory topics (`shopify.orders` or `shopify.events`).

### `POST /webhooks/shopify/compliance`

GDPR and `app/uninstalled` compliance topics. Same HMAC rules as above.

---

## Error format

```json
{ "error": "Human-readable message" }
```

Validation errors may include `details` with Zod flatten output.
