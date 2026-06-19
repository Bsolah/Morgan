# Morgan

Mobile-first AI CFO for Shopify merchants.

## Mobile app (local dev)

See **[apps/mobile/README.md](apps/mobile/README.md)** for full setup.

```bash
# From repo root — iOS Simulator
pnpm mobile:ios

# Android Emulator (requires Android Studio + SDK)
pnpm mobile:android

# List devices
pnpm mobile:devices
```

**Note:** This machine runs macOS 12. Use Flutter **3.38.10** (installed at `~/development/flutter`). Newer Flutter versions require macOS 14+.

## Backend API (local dev)

```bash
pnpm install
docker compose up -d   # Postgres on :5434, Redis on :6380
cp .env.example .env

export DATABASE_URL=postgresql://morgan:morgan@localhost:5434/morgan
pnpm db:push
pnpm dev:api
```

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness |
| `GET /ready` | Readiness (Postgres + Redis) |
| `POST /api/v1/auth/shopify/token-exchange` | Auth stub → JWT |
| `POST /api/v1/auth/refresh` | Refresh access token |
| `GET /api/v1/auth/me` | Current user (Bearer) |
| `POST /webhooks/shopify` | Shopify webhook (HMAC) |

## Documentation

- [Docs index](docs/README.md)
- [Local development](docs/local-development.md)
- [API reference](docs/api-reference.md)
- [Founding CTO Blueprint](docs/morgan-founder-blueprint.md)
- [User Stories](docs/morgan-user-stories.md)

## CI

GitHub Actions runs on push/PR to `main`:

- **API** — typecheck, `db:push`, integration + API tests (Postgres + Redis services)
- **Mobile** — `flutter analyze` + `flutter test` (Flutter 3.38.10)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
