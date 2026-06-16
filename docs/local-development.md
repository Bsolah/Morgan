# Local Development

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24.x | API + packages |
| pnpm | 10.x | `corepack enable` |
| Docker | Latest | Postgres + Redis |
| Flutter | **3.38.10** | macOS 12 requires pinned version — see [mobile README](../apps/mobile/README.md) |
| Xcode | 14+ | iOS Simulator |
| Android Studio | Latest | Android Emulator (optional) |

## 1. Clone and install

```bash
cd /Users/admin/Documents/Morgan
corepack enable
pnpm install
cp .env.example .env
```

Edit `.env` — minimum for API:

```bash
JWT_SECRET=change-me-in-production-min-32-characters-long
SHOPIFY_API_SECRET=your-shopify-app-client-secret
DATABASE_URL=postgresql://morgan:morgan@localhost:5433/morgan
REDIS_URL=redis://localhost:6380
```

## 2. Start infrastructure

```bash
docker compose up -d
docker compose ps   # verify healthy
```

| Service | Host port | Credentials |
|---------|-----------|-------------|
| PostgreSQL 16 | `5433` | `morgan` / `morgan` / db `morgan` |
| Redis 7 | `6380` | no auth |

## 3. Database schema

```bash
export DATABASE_URL=postgresql://morgan:morgan@localhost:5433/morgan
pnpm db:push
```

## 4. Run API server

```bash
pnpm dev:api
```

Verify:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

## 5. Run mobile app

```bash
# iOS Simulator
pnpm mobile:ios

# Android Emulator (after Android Studio setup)
pnpm mobile:android
```

API base URL is auto-configured per platform in `apps/mobile/lib/core/config/app_config.dart`:

- iOS Simulator → `http://localhost:8080`
- Android Emulator → `http://10.0.2.2:8080`

Override:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8080
```

## 6. Test Shopify webhooks locally

Use [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) or `curl` with a valid HMAC:

```bash
SECRET="your-shopify-app-client-secret"
BODY='{"id":123,"total_price":"99.00"}'
HMAC=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

curl -X POST http://localhost:8080/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: demo.myshopify.com" \
  -d "$BODY"
```

Bronze events are written to `./data/bronze/` (configurable via `BRONZE_STORAGE_PATH`).

## 7. Run tests

```bash
pnpm test              # all packages with tests
pnpm typecheck         # TypeScript project references
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ready` returns 503 | Start `docker compose up -d`; check `DATABASE_URL` |
| Port 5433 in use | Change host port in `docker-compose.yml` |
| Flutter macOS 14 error | Pin Flutter 3.38.10 — see mobile README |
| HMAC 401 on webhooks | Set `SHOPIFY_API_SECRET` in `.env` |
