# Morgan — User Stories & Acceptance Criteria

> **Project:** Morgan (standalone greenfield — not OctoPing)  
> **Format:** Epic → User Story → Acceptance Criteria  
> **Priority key:** `P0` MVP (90 days) · `P1` Growth (days 91–180) · `P2` Scale (181+)  
> **Personas:** Sam (Solo Operator) · Grace (Growth Operator) · Marcus (Multi-Brand) · Fiona (Fractional CFO)

---

## Table of Contents

1. [EPIC-01: Authentication & Onboarding](#epic-01-authentication--onboarding)
2. [EPIC-02: Shopify Integration](#epic-02-shopify-integration)
3. [EPIC-03: Meta Ads Integration](#epic-03-meta-ads-integration)
4. [EPIC-04: Open Banking (Plaid)](#epic-04-open-banking-plaid)
5. [EPIC-05: QuickBooks Integration](#epic-05-quickbooks-integration)
6. [EPIC-06: Google Ads Integration](#epic-06-google-ads-integration)
7. [EPIC-07: Xero Integration](#epic-07-xero-integration)
8. [EPIC-08: Data Pipeline & Warehouse](#epic-08-data-pipeline--warehouse)
9. [EPIC-09: Unit Economics & Financial Model](#epic-09-unit-economics--financial-model)
10. [EPIC-10: Daily Briefing](#epic-10-daily-briefing)
11. [EPIC-11: Morgan Chat](#epic-11-morgan-chat)
12. [EPIC-12: Profit Dashboard](#epic-12-profit-dashboard)
13. [EPIC-13: Cash Overview](#epic-13-cash-overview)
14. [EPIC-14: Inventory Overview](#epic-14-inventory-overview)
15. [EPIC-15: Marketing Overview](#epic-15-marketing-overview)
16. [EPIC-16: Recommendations Feed](#epic-16-recommendations-feed)
17. [EPIC-17: Alerts System](#epic-17-alerts-system)
18. [EPIC-18: Profit Leak Detection Engine](#epic-18-profit-leak-detection-engine)
19. [EPIC-19: Forecasting Engine](#epic-19-forecasting-engine)
20. [EPIC-20: Recommendation Ranking Engine](#epic-20-recommendation-ranking-engine)
21. [EPIC-21: Inventory Planning Engine](#epic-21-inventory-planning-engine)
22. [EPIC-22: Pricing Optimization Engine](#epic-22-pricing-optimization-engine)
23. [EPIC-23: Marketing Budget Allocation Engine](#epic-23-marketing-budget-allocation-engine)
24. [EPIC-24: Scenario Planner](#epic-24-scenario-planner)
25. [EPIC-25: Notification System](#epic-25-notification-system)
26. [EPIC-26: Integrations Hub](#epic-26-integrations-hub)
27. [EPIC-27: Settings & Configuration](#epic-27-settings--configuration)
28. [EPIC-28: Billing & Subscriptions](#epic-28-billing--subscriptions)
29. [EPIC-29: Real-Time Event Processing](#epic-29-real-time-event-processing)
30. [EPIC-30: Security, Privacy & Compliance](#epic-30-security-privacy--compliance)
31. [EPIC-31: Team & Multi-Store (Scale)](#epic-31-team--multi-store-scale)
32. [EPIC-32: Web Dashboard (Scale)](#epic-32-web-dashboard-scale)
33. [EPIC-33: Outcome Tracking & Attribution](#epic-33-outcome-tracking--attribution)
34. [EPIC-34: Platform Infrastructure](#epic-34-platform-infrastructure)
35. [Mobile UX Design (implementation stories)](./morgan-ux-user-stories.md)

---

## EPIC-01: Authentication & Onboarding

### US-01-01: Connect Shopify store from mobile app `P0`

**As** Sam, a Shopify merchant,  
**I want** to connect my Shopify store from the Morgan mobile app,  
**So that** I can start using Morgan without installing anything from the Shopify App Store.

**Acceptance criteria:**
- [ ] Merchant downloads Morgan from the iOS App Store or Google Play (or TestFlight/internal build during beta)
- [ ] Onboarding includes **Connect Shopify** — merchant enters `shop_domain` or signs in via Shopify
- [ ] Connect flow opens Shopify OAuth consent screen (unlisted Partner app) showing required scopes
- [ ] On successful OAuth, merchant returns to Morgan via universal link / app deep link (`morgan://onboarding` or equivalent)
- [ ] A `store` record is created with `shop_domain`, `timezone`, `currency`, and `organization` linkage
- [ ] OAuth access token is encrypted at rest in `integration_credentials`
- [ ] Failed OAuth shows actionable error ("Connection failed — try again") without exposing internal errors
- [ ] Re-connecting a previously disconnected store creates a fresh sync run; historical data purged per `shop/redact` policy
- [ ] Merchant does **not** need to find or install Morgan from the Shopify App Store for this flow to work

---

### US-01-02: Complete mobile onboarding `P0`

**As** Sam,  
**I want** a guided onboarding flow after I download Morgan,  
**So that** I understand what Morgan does and when I'll see value.

**Acceptance criteria:**
- [ ] Onboarding shows 4 steps max: Welcome → Connect Shopify → Connect confirmed → Sync in progress
- [ ] Welcome screen states value prop: "Morgan — your AI CFO, not a dashboard"
- [ ] Connect Shopify step is skippable only if store is already linked (returning user)
- [ ] Sync screen shows progress: orders, products, inventory with % complete and ETA
- [ ] Merchant can skip optional integration steps (Meta, Plaid) and proceed to home
- [ ] Onboarding completes in <60 seconds of merchant interaction (excluding sync wait)
- [ ] First-time user lands on Home screen with empty state if sync <50%: "Your first briefing arrives within 24 hours"

---

### US-01-03: Authenticate on mobile app `P0`

**As** Sam,  
**I want** to log in to the Flutter app using my Shopify-connected store,  
**So that** I can access my briefings on my phone.

**Acceptance criteria:**
- [ ] App supports Shopify OAuth via in-app browser or universal link
- [ ] Session token exchange returns JWT access token (15 min) + refresh token (7 days)
- [ ] Tokens stored in `flutter_secure_storage`; never in plain SharedPreferences
- [ ] Expired access token auto-refreshes without user re-login
- [ ] Logout clears local cache and tokens
- [ ] Biometric unlock (Face ID / fingerprint) optional after first login
- [ ] 401 responses redirect to re-auth flow with session preserved intent (deep link return)

---

### US-01-04: Configure finance profile during onboarding `P0`

**As** Sam,  
**I want** to set how Morgan calculates my product costs,  
**So that** profit numbers reflect my business.

**Acceptance criteria:**
- [ ] Merchant selects COGS method: `Shopify unit cost` (default), `Manual %`, or `QuickBooks` (disabled until connected)
- [ ] Manual % accepts 0–100 with validation
- [ ] Selection persists in `merchant_finance_config`
- [ ] Changing COGS method triggers metric recalculation within 1 hour
- [ ] UI explains each method in plain language (≤2 sentences each)

---

### US-01-05: Install from Shopify App Store (optional distribution) `P1`

**As** Sam, a Shopify merchant,  
**I want** to discover and install Morgan from the Shopify App Store,  
**So that** I can connect my store from Shopify Admin if I prefer that entry point.

**Acceptance criteria:**
- [ ] Merchant can find "Morgan" in Shopify App Store with listing title, screenshots, and privacy policy link
- [ ] Install flow redirects to Shopify OAuth consent screen showing required scopes
- [ ] On successful OAuth, merchant is redirected to Morgan onboarding (mobile deep link or lightweight embedded web bridge)
- [ ] Same `store` record and encrypted `integration_credentials` behavior as US-01-01
- [ ] Re-installing on a previously uninstalled store creates a fresh sync run; historical data purged per `shop/redact` policy
- [ ] Listing is optional for MVP — unlisted Partner app + mobile connect (US-01-01) is sufficient for launch

---

## EPIC-02: Shopify Integration

### US-02-01: Ingest orders via webhooks `P0`

**As** the system,  
**I want** to receive Shopify order webhooks in real time,  
**So that** financial metrics stay current.

**Acceptance criteria:**
- [ ] Webhook endpoint `POST /webhooks/shopify` validates `X-Shopify-Hmac-Sha256`; invalid → 401
- [ ] Subscribed topics: `orders/create`, `orders/updated`, `orders/cancelled`, `refunds/create`
- [ ] Each event published to Kafka topic `shopify.orders` with envelope: `event_id`, `store_id`, `occurred_at`, `payload`
- [ ] Duplicate `event_id` within 24h is ignored (idempotent)
- [ ] Processing latency from webhook receipt to ClickHouse upsert <5 minutes (P95)
- [ ] Failed processing retries 3× with exponential backoff; dead-letter to S3 after exhaustion
- [ ] Webhook handler returns 200 within 5 seconds (async processing)

---

### US-02-02: Historical order backfill on connect `P0`

**As** Sam,  
**I want** my last 90 days of orders imported when I connect,  
**So that** my first briefing has meaningful context.

**Acceptance criteria:**
- [ ] On Shopify connect, bulk operation job fetches orders for trailing 90 days
- [ ] Job status visible in sync progress UI: "Importing order history… 12,400 / 18,000"
- [ ] Backfill completes within 4 hours for stores with ≤50K orders
- [ ] Partial brief available after 50% order sync (configurable threshold)
- [ ] Backfill is resumable on failure without duplicating records

---

### US-02-03: Sync products and inventory `P0`

**As** the system,  
**I want** product catalog and inventory levels in the warehouse,  
**So that** SKU economics and stockout alerts are accurate.

**Acceptance criteria:**
- [ ] Products synced via GraphQL: variants, SKU, price, `inventoryItem.unitCost`
- [ ] Inventory levels synced per location via `inventory_levels/update` webhook + daily poll
- [ ] `fact_order_lines` and `dim_products` linked by `sku` and `variant_id`
- [ ] Product updates reflected in warehouse within 15 minutes (P95)
- [ ] Deleted/archived products marked `is_active = false`; not removed from historical facts

---

### US-02-04: Sync Shopify Payments payouts `P1`

**As** Grace,  
**I want** payout data from Shopify Payments,  
**So that** Morgan can reconcile revenue to cash.

**Acceptance criteria:**
- [ ] Daily poll of `shopifyPaymentsAccount` balance and payout schedule
- [ ] Payout amounts stored in `mart_cash_daily` as expected inflows
- [ ] Payout delay >3 days vs historical average triggers info alert
- [ ] Stores not on Shopify Payments show "Payout data unavailable" — no errors

---

### US-02-05: Handle app uninstall and GDPR webhooks `P0`

**As** the system,  
**I want** to comply with Shopify mandatory webhooks,  
**So that** we remain App Store compliant.

**Acceptance criteria:**
- [ ] `app/uninstalled`: revoke tokens, mark store `status = uninstalled`, cancel subscription job
- [ ] `shop/redact`: delete all store data within 30 days; immediate soft-delete + async purge
- [ ] `customers/data_request`: return customer data JSON within 30 days via internal tooling
- [ ] `customers/redact`: redact PII for specified customer across orders and chat logs
- [ ] All compliance webhooks have integration tests with HMAC fixtures

---

## EPIC-03: Meta Ads Integration

### US-03-01: Connect Meta Ads account `P0`

**As** Sam,  
**I want** to connect my Meta (Facebook/Instagram) ad account,  
**So that** Morgan can analyze ad profitability not just ROAS.

**Acceptance criteria:**
- [ ] Integrations Hub shows "Meta Ads" card with Connect CTA
- [ ] OAuth via Facebook Login for Business with `ads_read` permission
- [ ] Merchant selects ad account if multiple available
- [ ] Connection status: `connected`, `syncing`, `error`, `disconnected`
- [ ] Token refresh handled automatically; expiry alert after 2 failed refreshes
- [ ] Disconnect revokes token and stops sync jobs

---

### US-03-02: Sync Meta campaign performance `P0`

**As** the system,  
**I want** to pull campaign-level spend and conversion data every 4 hours,  
**So that** POAS calculations are current.

**Acceptance criteria:**
- [ ] Sync pulls: account, campaign, ad set, ad level — spend, impressions, clicks, purchases, purchase value
- [ ] Data stored in `mart_ad_performance` grain: `store × channel × campaign × day`
- [ ] Rate limits respected via batch insights API; backoff on 429
- [ ] Sync errors surface in Integrations Hub with last successful sync timestamp
- [ ] Initial backfill: trailing 90 days of daily insights

---

### US-03-03: Calculate POAS (Profit on Ad Spend) `P0`

**As** Sam,  
**I want** to see profit-based ad metrics, not just ROAS,  
**So that** I know which campaigns actually make money.

**Acceptance criteria:**
- [ ] POAS = sum(contribution_margin of Meta-attributed orders) / ad_spend
- [ ] Attribution matches Shopify orders with `utm_source` containing `facebook` or `meta` (configurable rules)
- [ ] POAS displayed on Marketing Overview and in daily brief when Meta connected
- [ ] POAS shown alongside ROAS with tooltip explaining difference
- [ ] Campaigns with POAS <1.0 for 7 consecutive days flagged as `ad_waste` leak

---

## EPIC-04: Open Banking (Plaid)

### US-04-01: Connect bank account via Plaid `P1`

**As** Grace,  
**I want** to link my business bank account,  
**So that** Morgan can forecast cash runway.

**Acceptance criteria:**
- [ ] `POST /integrations/plaid/link-token` returns Plaid Link token
- [ ] Flutter opens Plaid Link SDK; success returns `public_token`
- [ ] Public token exchanged server-side; access token encrypted in `integration_credentials`
- [ ] Supports checking and savings business accounts (US via Plaid)
- [ ] Privacy disclosure shown before Link: "We read transactions to forecast cash, never move money"
- [ ] Connection appears in Integrations Hub with institution name and last 4 digits

---

### US-04-02: Sync bank transactions `P1`

**As** the system,  
**I want** to sync transactions and balances via Plaid Transactions Sync API,  
**So that** cash position is accurate.

**Acceptance criteria:**
- [ ] Initial pull: 24 months history
- [ ] Ongoing sync every 4–12 hours + Plaid webhook on updates
- [ ] Balance snapshots stored daily in `mart_cash_daily`
- [ ] Transactions categorized: `shopify_payout`, `ad_spend`, `cogs_payment`, `payroll`, `saas`, `other`
- [ ] Uncategorized transactions queued for merchant classification (batch UI, not per-txn)

---

### US-04-03: Match Shopify payouts to bank deposits `P1`

**As** Grace,  
**I want** Morgan to match Shopify payouts to bank deposits,  
**So that** I trust the cash timeline.

**Acceptance criteria:**
- [ ] Fuzzy match: amount ±1% and date window 1–3 business days
- [ ] Match confidence score stored; >90% auto-matched
- [ ] Unmatched payouts and deposits flagged in Cash Overview
- [ ] Merchant can manually link/unlink matches

---

### US-04-04: Display cash runway `P1`

**As** Sam,  
**I want** to see how many days of cash I have left,  
**So that** I avoid surprise crunches.

**Acceptance criteria:**
- [ ] Runway = current_balance / trailing_30d_avg_daily_net_outflow
- [ ] Displayed on Home KPI tile and Cash Overview
- [ ] Runway <30 days → warning alert; <7 days → critical alert
- [ ] Without bank connected, runway shows "Connect bank" CTA — not a fabricated number
- [ ] Runway recalculates daily by 6am merchant local time

---

## EPIC-05: QuickBooks Integration

### US-05-01: Connect QuickBooks Online `P1`

**As** Grace,  
**I want** to connect QuickBooks Online,  
**So that** Morgan uses my actual books for costs and expenses.

**Acceptance criteria:**
- [ ] Intuit OAuth 2.0 flow with `com.intuit.quickbooks.accounting` scope
- [ ] Merchant selects correct QBO company if multiple
- [ ] Connection status in Integrations Hub
- [ ] Token refresh handled; 90-day re-auth prompt

---

### US-05-02: Import COGS and operating expenses `P1`

**As** the system,  
**I want** to pull P&L and expense data from QBO daily,  
**So that** contribution margin reflects real books.

**Acceptance criteria:**
- [ ] Daily sync: P&L report (month-to-date), bills, purchases, deposits
- [ ] Account mapping UI: QBO accounts → Morgan categories (COGS, shipping, marketing, opex)
- [ ] When COGS method = `QuickBooks`, margin calculations use QBO COGS
- [ ] Discrepancy >5% between Shopify unit cost and QBO COGS triggers info alert with both values
- [ ] Sync failures retry; merchant notified after 3 consecutive failures

---

## EPIC-06: Google Ads Integration

### US-06-01: Connect Google Ads account `P2`

**As** Grace,  
**I want** to connect Google Ads,  
**So that** Morgan includes Search and Shopping performance in budget recommendations.

**Acceptance criteria:**
- [ ] OAuth 2.0 with `adwords` scope; developer token configured server-side
- [ ] Merchant selects manager account and client account if applicable
- [ ] Connection card in Integrations Hub marked "Available" (not "Soon")
- [ ] Initial 90-day campaign performance backfill

---

### US-06-02: Sync Google Ads campaign metrics `P2`

**As** the system,  
**I want** to pull campaign cost and conversion data daily,  
**So that** POAS includes Google-attributed orders.

**Acceptance criteria:**
- [ ] GAQL query pulls: campaign, cost, conversions, conversion value
- [ ] Shopping campaign product-level performance (P2.1)
- [ ] Attribution via `gclid` and `utm_source=google` on Shopify orders
- [ ] POAS computed per campaign; included in Marketing Budget Allocation Engine
- [ ] Sync respects Google Ads API quotas; paginated queries

---

## EPIC-07: Xero Integration

### US-07-01: Connect Xero accounting `P2`

**As** Marcus (UK merchant),  
**I want** to connect Xero,  
**So that** my UK store uses the same COGS logic as US merchants with QuickBooks.

**Acceptance criteria:**
- [ ] Xero OAuth 2.0 with accounting scopes
- [ ] Tenant selection if multiple organisations
- [ ] Uses shared `AccountingProvider` abstraction (same interface as QBO)
- [ ] P&L, bank transactions, invoices synced daily

---

### US-07-02: Unified accounting abstraction `P2`

**As** a developer,  
**I want** a provider-agnostic accounting interface,  
**So that** engines don't branch on QBO vs Xero.

**Acceptance criteria:**
- [ ] `AccountingProvider` interface: `fetchPnL`, `fetchExpenses`, `fetchDeposits`
- [ ] Implementations: `QuickBooksProvider`, `XeroProvider`
- [ ] Engine code consumes normalized `Expense[]`, `PnLReport` types only
- [ ] Integration tests with mocked providers for both

---

## EPIC-08: Data Pipeline & Warehouse

### US-08-01: Bronze layer event storage `P0`

**As** the system,  
**I want** raw integration events stored immutably in S3,  
**So that** we can replay and audit data.

**Acceptance criteria:**
- [ ] All Kafka events written to S3 path: `s3://bronze/{source}/{store_id}/{date}/{event_id}.json`
- [ ] Retention: 24 months
- [ ] Replay tooling can re-publish events to Kafka by date range + store
- [ ] Schema version in envelope; incompatible versions routed to quarantine prefix

---

### US-08-02: Silver and gold dbt models `P0`

**As** the system,  
**I want** dbt transforms producing tested gold marts,  
**So that** engines consume reliable metrics.

**Acceptance criteria:**
- [ ] Silver models: `stg_shopify_orders`, `stg_shopify_products`, `stg_meta_ads`, etc.
- [ ] Gold marts: `mart_orders_daily`, `mart_sku_economics`, `mart_ad_performance`, `mart_profit_leaks`, `mart_recommendations`
- [ ] dbt tests: `not_null`, `unique`, `relationships` on critical keys
- [ ] Dagster schedules hourly gold refresh + on-demand for chat queries
- [ ] Failed dbt run alerts engineering via PagerDuty/Slack

---

### US-08-03: ClickHouse serving layer `P0`

**As** the AI SQL agent,  
**I want** fast aggregations over order and ad facts,  
**So that** chat responses return within 3 seconds.

**Acceptance criteria:**
- [ ] Gold marts replicated/synced to ClickHouse tables
- [ ] Partition by month; `ORDER BY (store_id, date)`
- [ ] Query guardrails: max 90-day range, max 10K rows, mandatory `store_id` filter
- [ ] P95 query latency <500ms for standard metric queries
- [ ] Read-only credentials for SQL agent; no write access

---

### US-08-04: Postgres metric snapshots `P0`

**As** the mobile app,  
**I want** precomputed KPI snapshots in Postgres,  
**So that** home screen loads without heavy OLAP queries.

**Acceptance criteria:**
- [ ] `metric_snapshots` table: `store_id`, `metric_key`, `value`, `period`, `as_of`, `source`
- [ ] Snapshots updated after each gold mart refresh
- [ ] API `GET /stores/{id}/metrics` reads snapshots only (no live ClickHouse on home load)
- [ ] Staleness indicator if snapshot >6 hours old

---

## EPIC-09: Unit Economics & Financial Model

### US-09-01: Calculate contribution margin per order `P0`

**As** the system,  
**I want** to compute contribution margin for every order line,  
**So that** profit metrics are trustworthy.

**Acceptance criteria:**
- [ ] Formula: `gross_revenue - discounts - COGS - shipping_cost - payment_fees - allocated_ad_cost`
- [ ] COGS source per `merchant_finance_config.cogs_method`
- [ ] Payment fees: Shopify Payments rate or configurable %
- [ ] Shipping cost: actual label cost if available, else % of revenue (configurable default 8%)
- [ ] Ad cost allocation: proportional to UTM-attributed campaign spend
- [ ] Unit tests with 10 fixture orders covering edge cases (100% discount, refund, free shipping)

---

### US-09-02: Calculate MER (Marketing Efficiency Ratio) `P0`

**As** Sam,  
**I want** to see MER alongside margin,  
**So that** I understand marketing spend relative to total revenue.

**Acceptance criteria:**
- [ ] MER = total_ad_spend / total_net_revenue (trailing 7d and 30d)
- [ ] Displayed on Home KPI tile when Meta connected
- [ ] Tooltip explains MER vs ROAS
- [ ] MER excludes non-Meta spend until Google connected

---

### US-09-03: SKU-level unit economics `P1`

**As** Grace,  
**I want** profit broken down by SKU,  
**So that** I know which products drive or destroy margin.

**Acceptance criteria:**
- [ ] `mart_sku_economics`: unit margin, velocity, return rate per SKU per week
- [ ] SKUs ranked by total contribution profit (30d) on Profit Dashboard
- [ ] Tap SKU → see margin trend, return rate, ad spend attributed
- [ ] SKUs with <30 orders flagged "low confidence"

---

## EPIC-10: Daily Briefing

### US-10-01: Generate daily briefing at 6am local `P0`

**As** Sam,  
**I want** a daily financial briefing every morning,  
**So that** I start the day knowing what matters.

**Acceptance criteria:**
- [ ] Brief generated at 06:00 merchant local time (configurable in Settings)
- [ ] Brief contains: headline (≤140 chars), narrative (≤400 words), 3 KPI deltas, 1 top action card
- [ ] Narrative generated via LLM with structured JSON output schema
- [ ] All numbers in narrative match `metric_snapshots` within 0.1%
- [ ] Brief stored in `daily_briefings` with `briefing_date` unique per store
- [ ] Generation completes by 06:05 (P95)

---

### US-10-02: View daily brief on Home screen `P0`

**As** Sam,  
**I want** to read today's brief on the Home screen,  
**So that** I get value in one tap.

**Acceptance criteria:**
- [ ] Home shows: date, 3 KPI tiles (Profit, Cash/Runway placeholder, MER), brief card, top action
- [ ] KPI tiles show value + delta % vs prior period with color coding (green up profit, red down)
- [ ] "Read more" expands full narrative inline
- [ ] Cached brief renders in <500ms; network fetch <2s
- [ ] Pull-to-refresh fetches latest brief
- [ ] Empty state: "Your first briefing arrives by [datetime]"

---

### US-10-03: Regenerate brief on critical alert `P1`

**As** Sam,  
**I want** the brief updated when something critical happens,  
**So that** I'm not waiting until tomorrow.

**Acceptance criteria:**
- [ ] Critical alert triggers brief regeneration (max 1 extra/day)
- [ ] Push notification: "Updated brief: [headline]"
- [ ] Brief version incremented; prior version accessible in history
- [ ] Regeneration does not fire between 10pm–5am merchant local unless critical cash <3 days

---

### US-10-04: View briefing history `P1`

**As** Grace,  
**I want** to read past briefings,  
**So that** I can review trends and share with my team.

**Acceptance criteria:**
- [ ] Calendar or list view of last 30 days
- [ ] Tap date → full brief for that day
- [ ] Share button exports brief as PDF or text
- [ ] Offline: last 7 briefings cached locally

---

## EPIC-11: Morgan Chat

### US-11-01: Ask a financial question `P0`

**As** Sam,  
**I want** to ask "Why did profit drop yesterday?" in natural language,  
**So that** I get an explainable answer without building a report.

**Acceptance criteria:**
- [ ] Chat screen with message input and send button
- [ ] Response streams via SSE; first token <1.5s (P95)
- [ ] Response includes: answer text, ≥1 citation (source table + date), confidence indicator
- [ ] Suggested follow-up chips below response (≥2)
- [ ] Chat session persisted in `chat_sessions` / `chat_messages`
- [ ] Merchant can copy response text

---

### US-11-02: Contextual chat starters `P0`

**As** Sam,  
**I want** suggested questions based on my data,  
**So that** I know what to ask.

**Acceptance criteria:**
- [ ] Starters generated from active alerts and brief headline (e.g., "Why did margin drop?")
- [ ] Minimum 3 starters shown when chat is empty
- [ ] Tapping starter sends message immediately
- [ ] Starters refresh when brief or alerts update

---

### US-11-03: Chat cites data sources `P0`

**As** Grace,  
**I want** every number in chat linked to its data source,  
**So that** I trust the AI.

**Acceptance criteria:**
- [ ] Citations render as tappable chips: `[orders_daily · Jun 14]`
- [ ] Tap citation → shows source query summary and raw values
- [ ] Responses without citation for numeric claims are blocked by guardrail agent
- [ ] Citation timestamp shown; stale >48h shows warning badge

---

### US-11-04: Chat refuses out-of-scope requests `P0`

**As** the system,  
**I want** to refuse tax, legal, and investment advice,  
**So that** we avoid liability.

**Acceptance criteria:**
- [ ] Guardrail blocks: tax filing instructions, legal structure advice, investment recommendations
- [ ] Refusal message: "I can't provide tax/legal advice. I can show you the underlying profit data."
- [ ] Redirect offers relevant in-scope alternative
- [ ] 100% of golden-set adversarial prompts handled correctly in eval suite

---

### US-11-05: Chat action cards `P1`

**As** Sam,  
**I want** to accept a recommendation directly from chat,  
**So that** I can act without leaving the conversation.

**Acceptance criteria:**
- [ ] When chat suggests an action, inline action card renders with Accept/Dismiss
- [ ] Accept updates recommendation status and confirms in chat thread
- [ ] Action card links to full Recommendation Detail screen

---

### US-11-06: Scenario questions in chat `P1`

**As** Grace,  
**I want** to ask "What if I increase Meta spend 20%?",  
**So that** I get a projected impact without a spreadsheet.

**Acceptance criteria:**
- [ ] Forecast agent invoked for scenario intents
- [ ] Response includes: projected profit change range, cash impact, confidence band
- [ ] Assumptions stated explicitly (e.g., "Assumes current POAS holds")
- [ ] Option to save scenario to Scenario Planner

---

## EPIC-12: Profit Dashboard

### US-12-01: View contribution margin trend `P0`

**As** Sam,  
**I want** to see my contribution margin over time,  
**So that** I know if the business is getting healthier.

**Acceptance criteria:**
- [ ] 30-day margin trend chart on Profit Overview screen
- [ ] Current margin % with delta vs prior 30d
- [ ] Target margin shown if configured (default 40%)
- [ ] Below-target state shows warning badge
- [ ] Tap chart point → drill-down for that day's orders summary

---

### US-12-02: Tap metric for "why" explanation `P0`

**As** Sam,  
**I want** to tap any profit metric and get an explanation,  
**So that** I understand drivers without opening chat manually.

**Acceptance criteria:**
- [ ] Tap margin tile → bottom sheet with top 3 drivers (ranked by $ impact)
- [ ] Each driver tappable → opens chat pre-loaded with context
- [ ] Drivers computed from decomposition: COGS, discounts, refunds, ad spend, shipping
- [ ] Explanation loads in <2s

---

### US-12-03: View active profit leaks `P0`

**As** Sam,  
**I want** to see where profit is leaking,  
**So that** I know what to fix first.

**Acceptance criteria:**
- [ ] Profit Overview lists active leaks with severity icon and $ at risk
- [ ] Leak types: ad_waste, discount_bleed, return_drain, dead_stock (MVP)
- [ ] Tap leak → Leak Detail with evidence and linked recommendation
- [ ] Empty state: "No active leaks detected" with last scan timestamp

---

## EPIC-13: Cash Overview

### US-13-01: View cash position and runway `P1`

**As** Grace,  
**I want** a dedicated cash screen,  
**So that** I can monitor liquidity separately from profit.

**Acceptance criteria:**
- [ ] Shows: current balance, runway days, 30d avg daily net outflow
- [ ] Inflow/outflow breakdown chart (30d)
- [ ] Expected Shopify payout dates and amounts
- [ ] Without Plaid: CTA to connect; profit-only view with disclaimer

---

### US-13-02: View unmatched transactions `P1`

**As** Grace,  
**I want** to see payouts and deposits that don't match,  
**So that** I can fix reconciliation gaps.

**Acceptance criteria:**
- [ ] List of unmatched Shopify payouts and unmatched bank deposits
- [ ] Manual match UI: select payout + deposit → confirm link
- [ ] Match/unmatch audit logged

---

## EPIC-14: Inventory Overview

### US-14-01: View inventory health summary `P1`

**As** Sam,  
**I want** to see which SKUs are at risk of stockout or overstock,  
**So that** I don't tie up cash in dead inventory.

**Acceptance criteria:**
- [ ] Summary counts: SKUs at stockout risk, overstocked SKUs, total $ tied in overstock
- [ ] List top 10 SKUs by revenue with days-of-stock remaining
- [ ] Color coding: red <7d, yellow 7–14d, green >14d
- [ ] Tap SKU → reorder recommendation if applicable

---

### US-14-02: Configure supplier lead times `P1`

**As** Grace,  
**I want** to set lead times per supplier or SKU,  
**So that** reorder dates are accurate.

**Acceptance criteria:**
- [ ] Settings → Inventory: default lead time (days) + per-SKU overrides
- [ ] Lead time used in safety stock and reorder date calculations
- [ ] Bulk edit via CSV upload (P1.1)

---

## EPIC-15: Marketing Overview

### US-15-01: View campaign POAS leaderboard `P0`

**As** Sam,  
**I want** to see campaigns ranked by profit not revenue,  
**So that** I know where to cut or scale.

**Acceptance criteria:**
- [ ] Campaign list sorted by POAS (trailing 7d default; toggle 30d)
- [ ] Columns: campaign name, spend, attributed revenue, POAS, ROAS
- [ ] Campaigns with POAS <1.0 highlighted red
- [ ] Tap campaign → 30d spend/POAS trend + linked recommendation if ad_waste

---

### US-15-02: View blended MER and channel split `P1`

**As** Grace,  
**I want** marketing spend broken down by channel,  
**So that** I see total efficiency.

**Acceptance criteria:**
- [ ] Channel breakdown: Meta, Google (when connected), unattributed
- [ ] MER per channel and blended
- [ ] 30d trend chart

---

## EPIC-16: Recommendations Feed

### US-16-01: View ranked recommendations `P0`

**As** Sam,  
**I want** to see my top recommended actions with dollar impact,  
**So that** I know what to do next.

**Acceptance criteria:**
- [ ] Recommendations tab shows cards sorted by rank score
- [ ] Card fields: title, impact range ($), effort (low/med/high), confidence, category, expiry date
- [ ] Max 5 open recommendations displayed; others archived
- [ ] Empty state: "You're all caught up — check back after tomorrow's brief"
- [ ] Pull-to-refresh updates list

---

### US-16-02: View recommendation detail `P0`

**As** Sam,  
**I want** to see the evidence behind a recommendation,  
**So that** I can decide whether to act.

**Acceptance criteria:**
- [ ] Detail screen: full description, evidence bullets, impact range, confidence, suggested deadline
- [ ] "How we calculated this" expandable section with metric citations
- [ ] Accept and Dismiss buttons fixed at bottom
- [ ] Related leak or metric linked

---

### US-16-03: Accept a recommendation `P0`

**As** Sam,  
**I want** to accept a recommendation,  
**So that** Morgan tracks that I acted.

**Acceptance criteria:**
- [ ] Accept sets `status = accepted`, `accepted_at` timestamp
- [ ] Confirmation toast: "Got it — we'll track the impact over the next 30 days"
- [ ] Accepted card moves to "In progress" section
- [ ] Accept event triggers outcome tracking job (EPIC-33)

---

### US-16-04: Dismiss a recommendation `P0`

**As** Sam,  
**I want** to dismiss a recommendation with a reason,  
**So that** future suggestions improve.

**Acceptance criteria:**
- [ ] Dismiss requires reason selection: "Not relevant", "Already done", "Disagree", "Other"
- [ ] Optional free-text comment
- [ ] Dismissed recommendations not resurfaced for 14 days if same category + similar SKU/campaign
- [ ] Dismiss feeds ranking model feedback

---

## EPIC-17: Alerts System

### US-17-01: Receive margin drop alert `P0`

**As** Sam,  
**I want** to be notified when contribution margin drops significantly,  
**So that** I can investigate immediately.

**Acceptance criteria:**
- [ ] Alert fires when margin drops >10% vs 7d trailing average
- [ ] Severity: warning (>10%), critical (>20%)
- [ ] Alert body includes: magnitude, top driver, link to brief/chat
- [ ] Push notification for warning+ if enabled
- [ ] Alert stored in `alerts` with `read_at` nullable

---

### US-17-02: Receive ad waste alert `P0`

**As** Sam,  
**I want** to know when a campaign burns cash,  
**So that** I stop it before wasting more.

**Acceptance criteria:**
- [ ] Alert fires when campaign POAS <1.0 for 7 consecutive days and spend >$100
- [ ] Includes campaign name, 7d spend, POAS, suggested action
- [ ] Links to Marketing Overview and recommendation

---

### US-17-03: Receive stockout risk alert `P1`

**As** Sam,  
**I want** to know before best-selling SKUs run out,  
**So that** I don't lose sales.

**Acceptance criteria:**
- [ ] Alert fires when days-of-stock < lead_time + 3 for SKU in top 20% revenue
- [ ] Includes SKU name, days remaining, reorder recommendation link
- [ ] Severity: warning <7d, critical <3d

---

### US-17-04: Receive cash crunch alert `P1`

**As** Grace,  
**I want** critical notification when cash runway is dangerously low,  
**So that** I can act before missing payroll.

**Acceptance criteria:**
- [ ] Critical alert when runway <7 days
- [ ] Warning when runway <30 days
- [ ] Critical bypasses quiet hours for push
- [ ] Includes balance, daily burn, suggested actions

---

### US-17-05: Manage alerts feed `P0`

**As** Sam,  
**I want** an alerts inbox with read/unread state,  
**So that** I don't miss important signals.

**Acceptance criteria:**
- [ ] Alerts tab: reverse chronological, unread badge on tab icon
- [ ] Tap alert → detail with deep link to relevant screen
- [ ] Swipe to mark read
- [ ] Filter by severity: all, warnings, critical

---

## EPIC-18: Profit Leak Detection Engine

### US-18-01: Detect ad waste leaks `P0`

**As** the system,  
**I want** to identify campaigns with POAS below 1.0 sustained,  
**So that** merchants stop burning cash.

**Acceptance criteria:**
- [ ] Leak type `ad_waste` created when campaign POAS <1.0 for ≥7 days and spend ≥$100
- [ ] `amount_at_risk_usd` = projected 30d waste at current spend rate
- [ ] Evidence array includes campaign ID, name, POAS, spend
- [ ] Leak auto-resolves when POAS ≥1.0 for 3 consecutive days
- [ ] Unit tests with fixture campaign data

---

### US-18-02: Detect discount bleed leaks `P0`

**As** the system,  
**I want** to detect rising discount rates without conversion lift,  
**So that** merchants protect margin.

**Acceptance criteria:**
- [ ] Leak fires when discount_rate_7d > discount_rate_30d × 1.25 AND conversion_rate flat (±5%)
- [ ] Evidence: discount $, affected order count, top discount codes
- [ ] Recommendation generated: review discount strategy

---

### US-18-03: Detect return drain leaks `P0`

**As** the system,  
**I want** to flag SKUs with abnormally high return rates,  
**So that** merchants fix product or listing issues.

**Acceptance criteria:**
- [ ] Leak fires when SKU return_rate > category_mean + 2σ AND ≥10 returns
- [ ] Evidence: SKU, return rate, return $, top return reasons if available
- [ ] Category benchmark computed per store (not cross-merchant in MVP)

---

### US-18-04: Detect dead stock leaks `P0`

**As** the system,  
**I want** to identify inventory with >90 days supply and declining velocity,  
**So that** merchants free tied-up cash.

**Acceptance criteria:**
- [ ] Leak fires when days_of_stock >90 AND velocity_30d < velocity_90d × 0.7
- [ ] `amount_at_risk_usd` = inventory value at cost
- [ ] Recommendation: liquidation or bundle suggestion

---

### US-18-05: Run leak scan on schedule `P0`

**As** the system,  
**I want** to scan for leaks daily after gold mart refresh,  
**So that** detections are current.

**Acceptance criteria:**
- [ ] Dagster job runs leak detection at 05:30 merchant-local (staggered by timezone)
- [ ] New leaks create alerts; resolved leaks marked `resolved_at`
- [ ] Scan processes ≤60s per store (P95)
- [ ] Leak counts exposed on Profit Dashboard

---

## EPIC-19: Forecasting Engine

### US-19-01: Forecast 30-day revenue `P1`

**As** Grace,  
**I want** a 30-day revenue forecast with confidence bands,  
**So that** I can plan inventory and hiring.

**Acceptance criteria:**
- [ ] Prophet model trained on ≥90d daily revenue
- [ ] Output: P10, P50, P90 daily and cumulative
- [ ] MAPE tracked per store; displayed only if MAPE <25%
- [ ] Forecast refreshes nightly
- [ ] Stores with <60d history show "Insufficient data"

---

### US-19-02: Forecast 60-day cash runway `P1`

**As** Grace,  
**I want** a forward-looking cash projection,  
**So that** I see crunches before they happen.

**Acceptance criteria:**
- [ ] Requires Plaid connection
- [ ] Simulation: starting balance + forecasted inflows (payouts) - forecasted outflows (recurring + avg variable)
- [ ] Chart shows projected balance by day
- [ ] Flags date when balance crosses $0 (if applicable)
- [ ] Assumptions editable: expected ad spend, planned inventory purchase

---

### US-19-03: Forecast SKU demand `P2`

**As** Marcus,  
**I want** demand forecasts for top SKUs,  
**So that** inventory planning is proactive.

**Acceptance criteria:**
- [ ] Croston's method for intermittent demand; MA for high-velocity SKUs
- [ ] 30d unit forecast per SKU (top 50 by revenue)
- [ ] Forecast feeds Inventory Planning Engine

---

## EPIC-20: Recommendation Ranking Engine

### US-20-01: Generate candidates from engines `P0`

**As** the system,  
**I want** each engine to emit recommendation candidates,  
**So that** the ranker has actions to prioritize.

**Acceptance criteria:**
- [ ] Leak engine, inventory engine, marketing engine emit `RecommendationCandidate` objects
- [ ] Candidate schema: `engine`, `category`, `title`, `body`, `impact_low`, `impact_high`, `confidence`, `effort`, `evidence`, `expires_at`
- [ ] Candidates deduplicated by similarity hash (same SKU + category within 7d)

---

### US-20-02: Rank and cap recommendations `P0`

**As** Sam,  
**I want** only the most important actions surfaced,  
**So that** I'm not overwhelmed.

**Acceptance criteria:**
- [ ] Score = `impact × confidence × urgency / effort` (weights configurable)
- [ ] Top 5 candidates promoted to `recommendations` table
- [ ] Conflicting recommendations suppressed (e.g., raise price + add discount on same SKU)
- [ ] Ranking job runs after leak scan daily

---

## EPIC-21: Inventory Planning Engine

### US-21-01: Generate reorder recommendations `P1`

**As** Sam,  
**I want** to know when and how much to reorder,  
**So that** I avoid stockouts without over-ordering.

**Acceptance criteria:**
- [ ] Reorder point = `(avg_daily_velocity × lead_time) + safety_stock`
- [ ] Safety stock = `z × σ_demand × √(lead_time)` (z=1.65 default)
- [ ] Reorder qty = max(0, reorder_point - current_stock + velocity × lead_time)
- [ ] Recommendation includes: SKU, qty, cost estimate, cash impact on runway
- [ ] SKUs outside top 50 revenue excluded unless stockout <3d

---

### US-21-02: Generate overstock liquidation recommendations `P1`

**As** Grace,  
**I want** suggestions to clear dead inventory,  
**So that** I recover cash.

**Acceptance criteria:**
- [ ] Triggered by dead_stock leak
- [ ] Suggests: discount %, bundle, or pause reorders
- [ ] Impact range: cash recovered vs margin sacrificed
- [ ] Never suggests >10% price drop in one step

---

## EPIC-22: Pricing Optimization Engine

### US-22-01: Suggest price increases on high-velocity SKUs `P2`

**As** Grace,  
**I want** pricing suggestions backed by margin data,  
**So that** I capture profit without guessing.

**Acceptance criteria:**
- [ ] Suggests increase when: margin < target AND velocity_30d ≥ velocity_90d AND ≥30 orders
- [ ] Suggested change ≤5% per step
- [ ] Output: current price, suggested price, expected margin delta, expected unit delta (estimate)
- [ ] Confidence: low if <30 orders
- [ ] Recommendation only — no auto-price change

---

### US-22-02: Suggest price decreases for high-return SKUs `P2`

**As** Grace,  
**I want** to know when price may be driving returns,  
**So that** I fix margin erosion.

**Acceptance criteria:**
- [ ] Triggered when return_rate > category_mean + 2σ AND price > category_median
- [ ] Suggests 3–5% decrease or bundle alternative
- [ ] Evidence: return rate, competitor price range if available

---

## EPIC-23: Marketing Budget Allocation Engine

### US-23-01: Suggest budget reallocation across campaigns `P0`

**As** Sam,  
**I want** specific guidance on shifting ad budget,  
**So that** I maximize profit not just revenue.

**Acceptance criteria:**
- [ ] Analyzes marginal POAS curves per campaign (30d)
- [ ] Simulates shifts in $500 increments up to merchant's total budget
- [ ] Outputs top 3 scenarios: from_campaign, to_campaign, amount, projected_profit_delta
- [ ] Recommendation generated when projected delta >$200/mo
- [ ] Suggest only — no auto-apply in MVP

---

### US-23-02: Multi-channel budget optimization `P2`

**As** Grace,  
**I want** allocation across Meta and Google,  
**So that** total marketing profit is maximized.

**Acceptance criteria:**
- [ ] Linear programming solver (HiGHS) with constraints: total budget, min per channel
- [ ] Output: per-channel spend recommendation
- [ ] Requires ≥2 connected ad channels

---

## EPIC-24: Scenario Planner

### US-24-01: Run ad spend scenario `P1`

**As** Grace,  
**I want** to model "What if I increase Meta spend 20%?",  
**So that** I see profit and cash impact before committing.

**Acceptance criteria:**
- [ ] UI: slider or input for spend change % per channel
- [ ] Output: projected revenue, profit, cash runway change (ranges)
- [ ] Assumptions listed and editable
- [ ] Results saved to `scenarios` table with timestamp
- [ ] Runnable from chat or dedicated Scenario screen

---

### US-24-02: Run inventory purchase scenario `P1`

**As** Sam,  
**I want** to model a large inventory buy,  
**So that** I know if I can afford it.

**Acceptance criteria:**
- [ ] Input: SKU, quantity, unit cost
- [ ] Output: cash runway after purchase, projected stockout date, expected profit from units
- [ ] Warning if runway drops below 30 days

---

## EPIC-25: Notification System

### US-25-01: Receive daily brief push notification `P0`

**As** Sam,  
**I want** a push notification when my brief is ready,  
**So that** I open the app habitually.

**Acceptance criteria:**
- [ ] Push at 06:00 local: title = brief headline, body = top KPI delta
- [ ] Tap opens Home / today's brief (deep link)
- [ ] Opt-out available in Settings
- [ ] FCM token registered on app launch; refreshed on change

---

### US-25-02: Configure notification preferences `P0`

**As** Sam,  
**I want** to control which notifications I receive,  
**So that** I'm not overwhelmed.

**Acceptance criteria:**
- [ ] Toggles: daily brief, alerts (warning), alerts (critical), weekly email digest
- [ ] Quiet hours: start/end time (default 10pm–7am)
- [ ] Critical cash alerts override quiet hours (with disclosure)
- [ ] Preferences stored in `merchant_finance_config.notification_prefs`
- [ ] Changes take effect within 5 minutes

---

### US-25-03: Receive weekly email digest `P1`

**As** Grace,  
**I want** a weekly email summary,  
**So that** I have a record without opening the app.

**Acceptance criteria:**
- [ ] Email sent Monday 7am local
- [ ] Contains: week profit total, margin trend, top leak, top recommendation, runway
- [ ] Unsubscribe link compliant with CAN-SPAM
- [ ] Rendered via React Email templates; sent via Resend

---

## EPIC-26: Integrations Hub

### US-26-01: View all integrations status `P0`

**As** Sam,  
**I want** one screen showing all my connections,  
**So that** I know what's powering my brief.

**Acceptance criteria:**
- [ ] Cards: Shopify, Meta Ads, Bank (Plaid), QuickBooks, Google Ads
- [ ] Each shows: status icon, last sync time, error message if any
- [ ] Data coverage % bar: computed from required fields present
- [ ] CTA for disconnected integrations
- [ ] "Coming soon" badge for P2 integrations

---

### US-26-02: Reconnect failed integration `P0`

**As** Sam,  
**I want** to reconnect when a token expires,  
**So that** data flows resume.

**Acceptance criteria:**
- [ ] Error state shows human-readable reason ("Meta token expired")
- [ ] Reconnect button re-initiates OAuth/Link flow
- [ ] On success, sync job triggered immediately
- [ ] Success toast: "Meta Ads reconnected — syncing now"

---

## EPIC-27: Settings & Configuration

### US-27-01: Update COGS method `P0`

**As** Sam,  
**I want** to change how product costs are calculated,  
**So that** margins match my reality.

**Acceptance criteria:**
- [ ] Settings → Finance → COGS method dropdown
- [ ] Change triggers background recalculation
- [ ] Progress indicator during recalc
- [ ] Completion notification

---

### US-27-02: Set timezone and briefing time `P0`

**As** Sam,  
**I want** to set when I receive my brief,  
**So that** it arrives when I wake up.

**Acceptance criteria:**
- [ ] Timezone auto-detected from Shopify; manually overridable
- [ ] Briefing time picker (default 06:00)
- [ ] Next brief datetime shown
- [ ] Change applies from next calendar day

---

### US-27-03: Set target margin `P1`

**As** Grace,  
**I want** to set a target contribution margin,  
**So that** alerts and dashboards reflect my goals.

**Acceptance criteria:**
- [ ] Input 0–100%; default 40%
- [ ] Profit Dashboard shows progress to target
- [ ] Below-target triggers weekly summary in brief

---

## EPIC-28: Billing & Subscriptions

### US-28-01: Subscribe via Shopify Billing `P0`

**As** Sam,  
**I want** to subscribe through Shopify after my trial,  
**So that** billing is seamless.

**Acceptance criteria:**
- [ ] 14-day free trial starts on install (Shopify Billing API)
- [ ] Trial end prompts upgrade modal with plan options
- [ ] Plans: Starter $99, Growth $199 (MVP may ship single $149 plan)
- [ ] Charge appears on Shopify bill
- [ ] Subscription status gates features: chat limit on Starter, integrations on Growth
- [ ] `app_subscriptions/update` webhook updates `subscriptions` table

---

### US-28-02: Handle subscription cancellation `P0`

**As** Sam,  
**I want** to cancel from Shopify admin,  
**So that** I'm not locked in.

**Acceptance criteria:**
- [ ] Cancel via Shopify app subscriptions UI
- [ ] Webhook sets `status = cancelled`; access until period end
- [ ] Post-cancel: read-only access to last 30d briefings for 7 days
- [ ] Data deletion follows `shop/redact` timeline

---

### US-28-03: View billing in app `P1`

**As** Grace,  
**I want** to see my plan and billing date in the app,  
**So that** I know what I'm paying.

**Acceptance criteria:**
- [ ] Settings → Billing: plan name, price, renewal date, trial days remaining
- [ ] Upgrade CTA for Starter → Growth
- [ ] Link to Shopify manage subscription

---

## EPIC-29: Real-Time Event Processing

### US-29-01: Process events with idempotency `P0`

**As** the system,  
**I want** idempotent event processing,  
**So that** duplicates don't corrupt metrics.

**Acceptance criteria:**
- [ ] Redis `SETNX` on `event_id` with 24h TTL before processing
- [ ] Duplicate events acked but not reprocessed
- [ ] Metrics: duplicate rate, processing lag, error rate per topic

---

### US-29-02: Trigger real-time alerts on refund spike `P1`

**As** the system,  
**I want** to detect refund spikes within minutes,  
**So that** merchants react fast.

**Acceptance criteria:**
- [ ] On `refunds/create` webhook, rolling 24h refund total compared to 7d average
- [ ] Spike >2σ → warning alert within 10 minutes
- [ ] Alert includes refund $ and top affected SKUs

---

## EPIC-30: Security, Privacy & Compliance

### US-30-01: Encrypt credentials at rest `P0`

**As** the system,  
**I want** all integration tokens encrypted,  
**So that** a database breach doesn't expose third-party access.

**Acceptance criteria:**
- [ ] AES-256-GCM encryption via AWS KMS or Secrets Manager
- [ ] `integration_credentials.encrypted_payload` never stores plaintext
- [ ] Key rotation documented and tested annually

---

### US-30-02: Enforce store-scoped data access `P0`

**As** the system,  
**I want** every API query scoped to authorized stores,  
**So that** merchants cannot access other merchants' data.

**Acceptance criteria:**
- [ ] JWT contains `org_id` and `store_ids[]`
- [ ] Every DB query includes `store_id` filter from JWT — no client-supplied store_id trusted alone
- [ ] Integration tests attempt cross-tenant access → 403
- [ ] SQL agent enforces same scope

---

### US-30-03: Purge data on shop redact `P0`

**As** a compliance officer,  
**I want** complete data purge within 30 days of shop/redact,  
**So that** we meet Shopify GDPR requirements.

**Acceptance criteria:**
- [ ] Soft-delete immediate; hard-delete job within 30 days
- [ ] Purge covers: Postgres, ClickHouse, S3 bronze, chat logs, vector embeddings
- [ ] Purge job logged with completion certificate
- [ ] Integration test validates zero rows for `store_id` after purge

---

### US-30-04: PII redaction before LLM calls `P0`

**As** the system,  
**I want** customer PII stripped before sending to OpenAI,  
**So that** we minimize privacy risk.

**Acceptance criteria:**
- [ ] Customer names, emails, addresses masked in prompt context
- [ ] Order IDs retained (internal UUIDs, not Shopify customer PII)
- [ ] Redaction logged; unit tests with PII fixtures

---

## EPIC-31: Team & Multi-Store (Scale)

### US-31-01: Invite team member `P2`

**As** Marcus,  
**I want** to invite my ops manager with view-only access,  
**So that** they can see briefs without changing settings.

**Acceptance criteria:**
- [ ] Roles: `owner`, `admin`, `viewer`
- [ ] Invite via email; accept creates `users` record linked to `org_id`
- [ ] Viewer: read briefs, chat, recommendations; no settings/billing/integrations
- [ ] Seat limits per plan (Growth: 1, Scale: 3, additional $29/seat)

---

### US-31-02: Multi-store portfolio view `P2`

**As** Marcus,  
**I want** a consolidated briefing across stores,  
**So that** I see portfolio health in one place.

**Acceptance criteria:**
- [ ] Store switcher on Home
- [ ] Portfolio view: total profit, total runway, stores needing attention
- [ ] Per-store drill-down preserved
- [ ] Plan limit: Scale 3 stores, Portfolio unlimited

---

## EPIC-32: Web Dashboard (Scale)

### US-32-01: Access web dashboard `P2`

**As** Grace,  
**I want** a desktop web version,  
**So that** I can review finances on my laptop.

**Acceptance criteria:**
- [ ] React web app (Vite + Tailwind) with feature parity to mobile core: brief, profit, marketing, chat
- [ ] Responsive; not mobile-only wrapper
- [ ] Same auth (Shopify OAuth + JWT)
- [ ] URL: `app.getmorgan.com`

---

## EPIC-33: Outcome Tracking & Attribution

### US-33-01: Measure recommendation outcomes `P1`

**As** the system,  
**I want** to measure profit impact after a merchant accepts a recommendation,  
**So that** we prove value and improve ranking.

**Acceptance criteria:**
- [ ] On accept, snapshot baseline metrics (margin, spend, inventory $)
- [ ] At 7, 14, 30 days post-accept, compute `measured_impact_usd`
- [ ] Store in `recommendation_outcomes`
- [ ] Merchant sees outcome on accepted recommendation card: "Saved ~$420 so far"
- [ ] North-star dashboard: total profit influenced per org

---

## EPIC-34: Platform Infrastructure

### US-34-01: Deploy API with health checks `P0`

**As** a developer,  
**I want** a production API with health and readiness endpoints,  
**So that** orchestration and monitoring work.

**Acceptance criteria:**
- [ ] `GET /health` → 200 liveness
- [ ] `GET /ready` → 200 only if Postgres + Redis reachable
- [ ] Deployed on AWS ECS Fargate (or Railway for dev)
- [ ] Terraform modules for staging + prod
- [ ] GitHub Actions: test → build → deploy on merge to main

---

### US-34-02: Observability and alerting `P0`

**As** a developer,  
**I want** traces, logs, and error tracking,  
**So that** I can debug production issues.

**Acceptance criteria:**
- [ ] Sentry for API and Flutter errors
- [ ] Datadog (or Grafana Cloud) for metrics: API latency, webhook lag, brief generation time
- [ ] Langfuse for LLM trace logging with cost per store
- [ ] PagerDuty alert on: API error rate >1%, brief generation failures, webhook backlog >1000

---

### US-34-03: Feature flags `P1`

**As** a product manager,  
**I want** feature flags per merchant,  
**So that** we can beta test safely.

**Acceptance criteria:**
- [ ] PostHog feature flags integrated in Flutter and API
- [ ] Flags: `scenario_planner`, `pricing_engine`, `google_ads`
- [ ] Flag evaluation <50ms; fallback to default off

---

## Appendix A: MVP Sprint Mapping (P0 Stories)

| Sprint | Stories |
|--------|---------|
| **S1 (W1–2)** | US-01-01, 01-02, 01-03, 02-01, 02-02, 08-01, 34-01 |
| **S2 (W3–4)** | US-02-03, 02-05, 08-02, 08-03, 08-04, 09-01, 09-02 |
| **S3 (W5–6)** | US-03-01, 03-02, 03-03, 10-01, 10-02, 18-01–04, 18-05 |
| **S4 (W7–8)** | US-11-01–04, 12-01–03, 16-01–04, 17-01, 17-02, 17-05, 20-01–02 |
| **S5 (W9–10)** | US-23-01, 25-01, 25-02, 26-01–02, 27-01–02, 28-01–02, 30-01–04 |
| **S6 (W11–12)** | US-15-01, 34-02, polish, iOS/Android store submission, load test |

**P0 total: 52 stories** · **P1 includes US-01-05** (Shopify App Store listing — post-MVP)

---

## Appendix B: Story Count by Priority

| Priority | Epics | Stories |
|----------|-------|---------|
| P0 (MVP) | 22 | 52 |
| P1 (Growth) | 18 | 39 |
| P2 (Scale) | 10 | 18 |
| **Total** | **34** | **109** |

---

## Appendix C: Definition of Done (Global)

Every story is **Done** when:

- [ ] Code merged to `main` with peer review
- [ ] Unit tests for business logic (≥80% coverage on engines)
- [ ] API contract updated in OpenAPI spec if applicable
- [ ] Flutter widget test or integration test for UI stories
- [ ] Analytics event added to PostHog (see event catalog below)
- [ ] Feature flagged if P1+ rolling out incrementally
- [ ] Documentation updated in `/docs` if behavior is merchant-visible
- [ ] No P0 linter errors; Sentry clean for 24h in staging
- [ ] Product owner sign-off on acceptance criteria checklist

---

## Appendix D: Analytics Event Catalog

| Event | Trigger |
|-------|---------|
| `app_installed` | Mobile app first open |
| `shopify_connected` | Shopify OAuth complete |
| `onboarding_completed` | Skip/finish onboarding |
| `briefing_viewed` | Open home brief |
| `briefing_push_opened` | Tap push notification |
| `chat_message_sent` | User sends chat message |
| `chat_citation_tapped` | Tap citation chip |
| `recommendation_viewed` | Open detail |
| `recommendation_accepted` | Accept action |
| `recommendation_dismissed` | Dismiss with reason |
| `alert_opened` | Tap alert |
| `integration_connected` | Any integration OAuth success |
| `integration_failed` | Sync error surfaced |
| `subscription_started` | Trial → paid |
| `scenario_run` | Scenario planner executed |

---

*Document version: 1.0 — June 2026*  
*Project: Morgan (standalone)*
