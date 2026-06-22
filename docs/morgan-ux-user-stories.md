# Morgan Mobile — UX User Stories

> **Purpose:** Implementation-ready user stories for the dark-first, professional fintech UX across the Morgan Flutter app. Use this doc as your **redesign backlog** — pick a story, open the listed files, check off acceptance criteria in your PR.  
> **Design preview:** [morgan-dark-fintech-preview.canvas.tsx](../.cursor/projects/c-Users-bisola-adeniyi-Projects-PEA/canvases/morgan-dark-fintech-preview.canvas.tsx)  
> **Product behaviour:** [morgan-user-stories.md](./morgan-user-stories.md) (API, data, logic — not visual design)  
> **Personas:** Sam (Solo) · Grace (Growth) · Marcus (Multi-Brand) · Fiona (Fractional CFO)

---

## How to implement a story

1. **Pick a phase** from [Implementation order](#implementation-order) (start Phase 1 unless Brief is your focus).
2. **Find the story** in the [Implementation backlog](#implementation-backlog) — note **Route** and **Primary files**.
3. **Open the design preview** canvas for that screen (Brief · Profit · Alerts mockups).
4. **Implement** using only theme tokens: `context.morgan`, `MorganSpace`, `MorganRadius`, `Theme.of(context).textTheme`.
5. **Check every AC box** in your PR description; add a widget test or golden if the story is P0 layout.
6. **Mark status** in the backlog table below (`todo` → `partial` → `done`).

**Shared widgets** (reuse before inventing new UI):

| Widget | Path |
|--------|------|
| Shell / tabs | `apps/mobile/lib/shared/widgets/morgan_shell.dart` |
| Cards | `morgan_surface.dart`, `morgan_action_card.dart`, `morgan_metric_card.dart` |
| Buttons / chips | `morgan_primary_button.dart`, `morgan_chip.dart` |
| Headers / deep routes | `morgan_section_header.dart`, `morgan_detail_app_bar.dart` |
| Loading | `morgan_skeleton.dart` (`MorganShimmer`, `MorganBootstrapLoader`) |
| Empty states | `morgan_empty_state.dart` |
| Errors | `morgan_user_error.dart`, `morgan_error_state.dart` |
| Theme | `apps/mobile/lib/core/theme/morgan_colors.dart`, `morgan_typography.dart`, `morgan_theme.dart` |

---

## Implementation backlog

Status key: `done` · `partial` · `todo`

| ID | Phase | Status | Route / tab | Primary files |
|----|-------|--------|-------------|---------------|
| US-UX-00-01 | 1 | done | App-wide | `core/theme/morgan_theme.dart`, `app.dart`, `theme_provider.dart` |
| US-UX-00-02 | 1 | done | App-wide | `core/theme/morgan_typography.dart`, `morgan_theme.dart` |
| US-UX-00-03 | 1 | partial | App-wide | `core/theme/morgan_tokens.dart`, `integration_card_shared.dart`, `morgan_metric_card.dart` |
| US-UX-00-04 | 1 | partial | App-wide | `morgan_primary_button.dart`, `morgan_secondary_button.dart`, `morgan_settings_section.dart`, `morgan_scaffold.dart` |
| US-UX-00-05 | 1 | done | App-wide | `morgan_colors.dart`, `morgan_shell.dart`, feature screens |
| US-UX-15-01 | 1 | done | App-wide | `morgan_skeleton.dart`; home, alerts, recommendations, profit |
| US-UX-15-02 | 1 | done | App-wide | `morgan_empty_state.dart`, list screens |
| US-UX-15-03 | 1 | done | App-wide | `morgan_user_error.dart`, `morgan_error_state.dart` |
| US-UX-01-01 | 2 | done | Tab shell | `shared/widgets/morgan_shell.dart` |
| US-UX-01-02 | 2 | done | Tab shell | `morgan_shell.dart`, alerts provider |
| US-UX-01-03 | 2 | done | Deep routes | `morgan_back_button.dart`, `morgan_detail_app_bar.dart`, `MorganDetailScreenHeader` |
| US-UX-03-01 | 2 | done | `/home` | `features/home/presentation/home_screen.dart` |
| US-UX-03-02 | 2 | done | `/home` | `home_screen.dart`, `morgan_metric_card.dart` |
| US-UX-03-03 | 2 | done | `/home` | `home_screen.dart`, `morgan_action_card.dart` |
| US-UX-03-04 | 2 | done | `/home` | `home_screen.dart` (new quick-link row) |
| US-UX-03-05 | 2 | done | `/home`, brief detail | `morgan_action_card.dart` (`MorganBriefCard`) |
| US-UX-03-06 | 2 | done | `/home`, brief detail | `brief_formatters.dart`, `MorganBriefCard` |
| US-UX-03-07 | 2 | done | `/home` | `morgan_metric_card.dart`, `home_screen.dart` |
| US-UX-04-01 | 2 | partial | `/brief/:date` | `features/brief/presentation/brief_detail_screen.dart` |
| US-UX-04-02 | 2 | done | `/brief/history` | `features/brief/presentation/brief_history_screen.dart` |
| US-UX-02-01 | 2 | done | `/onboarding` | `onboarding_screen.dart`, `onboarding_step_indicator.dart` |
| US-UX-02-02 | 2 | done | `/onboarding` | `sync_progress_panel.dart`, `sync_providers.dart` |
| US-UX-02-03 | 2 | done | `/unlock` | `biometric_unlock_screen.dart` |
| US-UX-05-01 | 3 | done | `/recommendations` | `features/recommendations/presentation/recommendations_screen.dart` |
| US-UX-05-02 | 3 | done | `/recommendations/:id` | `recommendation_detail_screen.dart` |
| US-UX-05-03 | 3 | done | `/recommendations` | `recommendations_screen.dart` |
| US-UX-06-01 | 3 | done | `/chat` | `features/chat/presentation/chat_screen.dart` |
| US-UX-06-02 | 3 | done | `/chat` | `chat_screen.dart` |
| US-UX-06-03 | 3 | done | `/chat` | `chat_screen.dart` |
| US-UX-07-01 | 3 | done | `/alerts` | `features/alerts/presentation/alerts_screen.dart` |
| US-UX-07-02 | 3 | done | `/alerts/:id` | `alert_detail_screen.dart` |
| US-UX-07-03 | 3 | done | `/alerts` | `alerts_screen.dart`, `alert_detail_screen.dart`, `core/alerts/alert_visuals.dart` |
| US-UX-09-01 | 4 | done | `/profit` | `features/profit/presentation/profit_dashboard_screen.dart` |
| US-UX-09-02 | 4 | partial | `/profit` | `profit_dashboard_screen.dart`, section widgets, `morgan_skeleton.dart` |
| US-UX-09-03 | 4 | done | Leak / SKU routes | `profit_leak_detail_screen.dart`, `sku_detail_screen.dart` |
| US-UX-10-01 | 4 | done | `/cash` | `features/cash/presentation/cash_overview_screen.dart` |
| US-UX-10-02 | 4 | done | `/cash/unmatched` | `cash_unmatched_screen.dart`, `cash_overview_screen.dart` |
| US-UX-11-01 | 4 | done | `/marketing` | `marketing_overview_screen.dart`, `marketing_poas_tab.dart`, `marketing_mer_tab.dart` |
| US-UX-11-02 | 4 | done | Campaign detail | `campaign_detail_screen.dart`, `campaign_trend_chart.dart` |
| US-UX-12-01 | 4 | done | `/inventory` | `inventory_overview_screen.dart`, `inventory_repository.dart` |
| US-UX-12-02 | 4 | done | `/inventory/sku/:sku` | `inventory_sku_detail_screen.dart`, `inventory_velocity_trend_chart.dart` |
| US-UX-08-01 | 5 | done | `/settings` | `features/settings/presentation/settings_screen.dart` |
| US-UX-08-02 | 5 | done | Finance settings | `cogs_method_screen.dart`, `briefing_schedule_screen.dart`, `target_margin_screen.dart` |
| US-UX-08-03 | 5 | done | `/settings/notifications` | `notification_settings_screen.dart` |
| US-UX-13-01 | 5 | done | `/settings/integrations` | `integration_card_shared.dart`, `*_integration_card.dart` |
| US-UX-13-02 | 5 | done | QBO / Xero mapping | `quickbooks_account_mapping_screen.dart`, `xero_account_mapping_screen.dart`, `account_mapping_screen_shared.dart` |
| US-UX-14-01 | 5 | done | `/scenarios` | `features/scenarios/presentation/scenario_planner_screen.dart` |
| US-UX-16-01 | 6 | done | Deep routes | `morgan_detail_app_bar.dart`, detail `*_screen.dart` |
| US-UX-16-02 | 6 | done | `/recommendations/:id` | `recommendation_detail_screen.dart` |
| US-UX-16-03 | 6 | done | `/alerts/:id` | `alert_detail_screen.dart` |
| US-UX-16-04 | 6 | done | Leak / SKU routes | `profit_leak_detail_screen.dart`, `sku_detail_screen.dart` |
| US-UX-16-05 | 6 | done | Campaign / inventory SKU | `campaign_detail_screen.dart`, `inventory_sku_detail_screen.dart` |
| US-UX-16-06 | 6 | done | `/cash/unmatched` | `cash_unmatched_screen.dart` |
| US-UX-16-07 | 6 | done | Settings forms | `notification_settings_screen.dart`, `inventory_settings_screen.dart` |
| US-UX-15-04 | 6 | done | App-wide | `morgan_motion.dart`, `morgan_haptics.dart`, `morgan_shell_tab_fade.dart`, `morgan_fade_in.dart` |
| US-UX-15-05 | 6 | done | App-wide | `morgan_icon_button.dart`, `morgan_info_tooltip.dart`, `morgan_chart_frame.dart`, contrast tokens |
| US-UX-15-06 | 6 | done | App-wide | `brief_cache.dart`, `home_screen.dart`, `performance-baseline.md` |

---

## Table of Contents

1. [EPIC-UX-00: Design System Foundation](#epic-ux-00-design-system-foundation)
2. [EPIC-UX-01: App Shell & Navigation](#epic-ux-01-app-shell--navigation)
3. [EPIC-UX-02: Onboarding & Unlock](#epic-ux-02-onboarding--unlock)
4. [EPIC-UX-03: Brief Tab (Home)](#epic-ux-03-brief-tab-home)
5. [EPIC-UX-04: Brief Detail & History](#epic-ux-04-brief-detail--history)
6. [EPIC-UX-05: Actions Tab (Recommendations)](#epic-ux-05-actions-tab-recommendations)
7. [EPIC-UX-06: Ask Tab (Chat)](#epic-ux-06-ask-tab-chat)
8. [EPIC-UX-07: Alerts Tab](#epic-ux-07-alerts-tab)
9. [EPIC-UX-08: Settings & Configuration](#epic-ux-08-settings--configuration)
10. [EPIC-UX-09: Profit Dashboard](#epic-ux-09-profit-dashboard)
11. [EPIC-UX-10: Cash Overview](#epic-ux-10-cash-overview)
12. [EPIC-UX-11: Marketing Overview](#epic-ux-11-marketing-overview)
13. [EPIC-UX-12: Inventory Overview](#epic-ux-12-inventory-overview)
14. [EPIC-UX-13: Integrations Hub](#epic-ux-13-integrations-hub)
15. [EPIC-UX-14: Scenario Planner](#epic-ux-14-scenario-planner)
16. [EPIC-UX-15: Cross-Cutting UX](#epic-ux-15-cross-cutting-ux)
17. [EPIC-UX-16: Secondary & Detail Screens](#epic-ux-16-secondary--detail-screens)
18. [Implementation Order](#implementation-order)
19. [UX Definition of Done](#ux-definition-of-done)

---

## Design principles (all stories)

Every UX story assumes:

- **Dark theme default** — `MorganPalette.dark`; no light-mode regression required for MVP UX pass
- **Scan in 3 seconds** — one hero metric or headline visible without scrolling on phone-sized viewports
- **One primary action** per screen above the fold where business logic allows
- **Numbers first** — tabular figures, deltas, and units; prose is secondary
- **Progressive disclosure** — charts, SKU lists, and evidence open in sheets or detail routes
- **No decorative chrome** — flat surfaces, hairline borders, no gratuitous gradients or illustration

---

## EPIC-UX-00: Design System Foundation

### US-UX-00-01: Enforce dark theme as default `P0`

**As** Grace,  
**I want** Morgan to open in a polished dark theme,  
**So that** the app feels professional and easy on the eyes during long work sessions.

**Acceptance criteria:**
- [ ] App launches with `MorganPalette.dark` applied globally
- [ ] Background `#0C0B0A`, surfaces `#161514` / `#1E1D1A`, text hierarchy uses `textPrimary` / `textSecondary` / `textMuted`
- [ ] Status bar and system navigation use dark-appropriate icon brightness
- [ ] No screen renders with hard-coded light backgrounds outside theme tokens

---

### US-UX-00-02: Standardise typography hierarchy `P0`

**As** the system,  
**I want** consistent type scales across all screens,  
**So that** merchants instantly know what is a title, metric, label, or body copy.

**Acceptance criteria:**
- [ ] Screen titles: 20–22px semibold (`titleMedium` / `headlineSmall`)
- [ ] Hero metrics: 28–32px semibold, tabular figures where applicable
- [ ] Section labels: 10–11px uppercase or label style, `textMuted`
- [ ] Body: 14–16px regular, `textSecondary` for supporting copy
- [ ] All screens audited; no ad-hoc font sizes outside `ThemeData` + `MorganSpace`

---

### US-UX-00-03: Unify spacing and radius tokens `P0`

**As** a developer,  
**I want** all layouts to use `MorganSpace` and `MorganRadius`,  
**So that** spacing feels consistent and implementation is fast.

**Acceptance criteria:**
- [ ] Screen horizontal padding: `MorganSpace.screenH` (20)
- [ ] Card internal padding: `MorganSpace.card` (20)
- [ ] Section gaps: `sm` (12) between related items, `xl` (24) between sections
- [ ] Corner radius: `MorganRadius.sm` for chips/badges, `MorganRadius.md` for cards
- [ ] Lint or review checklist confirms no magic-number padding in feature screens

---

### US-UX-00-04: Shared component library pass `P0`

**As** Sam,  
**I want** buttons, cards, and metrics to look identical everywhere,  
**So that** I learn the UI once and trust it everywhere.

**Acceptance criteria:**
- [ ] All primary CTAs use `MorganPrimaryButton` (or single canonical button)
- [ ] Metric tiles use `MorganMetricCard` with label / value / delta / optional subtitle pattern
- [ ] Grouped settings use `MorganSurface` with zero-padding list + dividers
- [ ] Section headers use `MorganSectionHeader` or `MorganScreenHeader` — not raw `Text` titles
- [ ] Document component usage in a short `docs/mobile-ui-components.md` reference (optional follow-up)

---

### US-UX-00-05: Semantic colour for finance states `P1`

**As** Fiona,  
**I want** profit, loss, and warning states to use consistent colours,  
**So that** I read financial health at a glance without parsing labels.

**Acceptance criteria:**
- [ ] Positive deltas and profit figures: `palette.profit`
- [ ] Negative deltas and loss figures: `palette.loss`
- [ ] Warnings and below-target states: `palette.warning`
- [ ] Accent / primary interactive: `palette.accent` (gold in dark theme)
- [ ] No raw `Colors.green` / `Colors.red` in feature code

---

## EPIC-UX-01: App Shell & Navigation

### US-UX-01-01: Redesign bottom navigation for clarity `P0`

**As** Sam,  
**I want** a clear five-tab shell,  
**So that** I always know where Brief, Actions, Ask, Alerts, and Settings live.

**Acceptance criteria:**
- [ ] Tabs: Brief · Actions · Ask · Alerts · Settings (matches `MorganShell`)
- [ ] Selected tab: filled icon + accent-muted pill background + primary label colour
- [ ] Unselected: outline icon + muted label
- [ ] Tab bar background `navBar` with top hairline `borderSubtle`
- [ ] Tap target minimum 44×44pt per tab

---

### US-UX-01-02: Alerts badge on tab `P0`

**As** Grace,  
**I want** unread alert count on the Alerts tab,  
**So that** I notice issues without opening the feed.

**Acceptance criteria:**
- [ ] Badge shows unread count (cap display at `9+`)
- [ ] Badge hidden when count is 0
- [ ] Badge uses warning or accent fill; does not shift tab layout abruptly
- [ ] Badge clears when alerts marked read (existing provider behaviour preserved)

---

### US-UX-01-03: Deep links preserve shell context `P1`

**As** the system,  
**I want** routes like `/profit` and `/cash` to feel connected to the shell,  
**So that** merchants can return to Brief without getting lost.

**Acceptance criteria:**
- [ ] Full-screen routes (profit, cash, marketing, inventory) use consistent back affordance
- [ ] Back navigation returns to sensible parent (home or previous route)
- [ ] Optional: sticky mini-header pattern (title + back) shared across deep routes

---

## EPIC-UX-02: Onboarding & Unlock

### US-UX-02-01: Onboarding visual refresh `P0`

**As** Sam,  
**I want** onboarding to look trustworthy and simple,  
**So that** I feel confident connecting my store.

**Acceptance criteria:**
- [ ] Dark background full-bleed; logo centred on welcome step
- [ ] Max 4 steps visible in progress indicator
- [ ] One primary CTA per step; secondary actions are text buttons only
- [ ] Value prop headline ≤ 2 lines; supporting copy ≤ 3 lines
- [ ] Connect Shopify step shows scope summary in plain language

---

### US-UX-02-02: Sync progress panel `P0`

**As** Sam,  
**I want** sync progress that feels fast and honest,  
**So that** I know Morgan is working and when I can use the app.

**Acceptance criteria:**
- [ ] Per-domain rows: Orders · Products · Inventory with % and status icon
- [ ] Linear progress or step checkmarks; no indeterminate spinner-only state > 3s
- [ ] ETA copy when available ("About 2 minutes remaining")
- [ ] Success state transitions to home with brief teaser or "Your first brief arrives at 6:00 AM"

---

### US-UX-02-03: Biometric unlock screen `P1`

**As** Marcus,  
**I want** a minimal unlock screen,  
**So that** re-entry is fast and secure.

**Acceptance criteria:**
- [ ] Logo + "Unlock Morgan" + biometric prompt
- [ ] Fallback to Shopify re-auth as text link
- [ ] No marketing copy or distractions on unlock screen
- [ ] Error state: single line, retry button

---

## EPIC-UX-03: Brief Tab (Home)

> **Design reference:** Canvas frame "Brief (Home)" · **Route:** `/home` · **Files:** `home_screen.dart`, `MorganBriefCard`, `MorganMetricCard`, `MorganActionCard`

### US-UX-03-01: Brief home hero layout `P0`

**As** Grace,  
**I want** today's brief scannable in under 3 seconds,  
**So that** my morning check-in takes one glance.

**Implement in:** `apps/mobile/lib/features/home/presentation/home_screen.dart`

**Acceptance criteria:**
- [x] Brief card appears **above** KPI strip (headline first)
- [x] Above fold: date · brief headline (≤ 2 lines) · narrative excerpt (≤ 3 lines)
- [x] `MorganLogo` + History link in header row
- [x] Pull-to-refresh with accent-colour indicator
- [x] Loading: skeleton for headline + KPI row (not blank/spinner-only)

---

### US-UX-03-02: KPI strip on home `P0`

**As** Sam,  
**I want** key numbers directly under the brief,  
**So that** I see profit, runway, and marketing without leaving home.

**Implement in:** `home_screen.dart` (`_HomeKpiRow`), `morgan_metric_card.dart`

**Acceptance criteria:**
- [x] Three compact `MorganMetricCard` tiles: Profit · Cash runway · MER/Marketing
- [x] Compact mode: 22px values, tighter padding
- [x] Each shows value + delta where data exists
- [x] Bad trend colours value in `palette.loss` (not just delta badge)
- [x] Tap Profit → `/profit`; runway → `/cash`; marketing → `/marketing`
- [x] Empty/partial data shows em dash and helper subtitle

---

### US-UX-03-03: Priority action card `P0`

**As** Grace,  
**I want** one highlighted action from the brief,  
**So that** I know what to do next.

**Implement in:** `home_screen.dart`, `morgan_action_card.dart`

**Acceptance criteria:**
- [x] Single `MorganActionCard` below brief + KPIs when `topAction` exists
- [x] Shows action title, 2-line body, optional impact badge (`$ at risk`)
- [x] Primary tap opens relevant deep link (marketing, settings)
- [x] Secondary "Ask Morgan" opens chat with pre-filled starter prompt

---

### US-UX-03-04: Quick links to money surfaces `P1`

**As** Fiona,  
**I want** shortcuts to Profit, Cash, Marketing, and Inventory,  
**So that** I drill down without hunting in settings.

**Implement in:** `home_screen.dart` (new `_HomeQuickLinks` widget)

**Acceptance criteria:**
- [x] Horizontal scroll or 2×2 grid of compact link tiles below KPI strip
- [x] Each tile: icon + label only; no paragraph text
- [x] Tiles use `surfaceMuted` background; consistent height
- [x] Routes: `/profit`, `/cash`, `/marketing`, `/inventory`

---

### US-UX-03-05: Brief typography scale `P0` — **done**

**As** Grace,  
**I want** a smaller headline and body on the brief card,  
**So that** more content fits above the fold without shouting.

**Implement in:** `morgan_action_card.dart` (`MorganBriefCard`)

**Acceptance criteria:**
- [x] Headline: `titleMedium` (16px semibold), not `titleLarge`
- [x] Narrative: `bodyMedium` (14px), not `bodyLarge`
- [x] Tighter gap between headline and body (`xs` not `sm`)

---

### US-UX-03-06: Loss highlighting in brief copy `P0` — **done**

**As** Fiona,  
**I want** losses and negative figures in the brief narrative to stand out in red,  
**So that** I spot problems while scanning prose.

**Implement in:** `core/brief/brief_formatters.dart` (`buildBriefNarrativeSpans`), `MorganBriefCard`

**Acceptance criteria:**
- [x] Negative currency (`-$1,240`), negative % (`-4.2%`), and loss phrases highlighted in `palette.loss`
- [x] Highlighted spans use semibold weight
- [x] Same rendering on home and brief detail (`expandAll: true`)
- [x] Unit test in `test/brief/brief_formatters_test.dart`

---

### US-UX-03-07: Compact KPI hero row `P0` — **done**

**As** Sam,  
**I want** the KPI row to support the brief, not dominate it,  
**So that** the headline remains the visual anchor.

**Implement in:** `morgan_metric_card.dart` (`compact: true`), `home_screen.dart`

**Acceptance criteria:**
- [x] `MorganMetricCard.compact`: 22px metric values, reduced vertical padding
- [x] KPI row sits below brief card
- [ ] Optional: reduce to 2 tiles if 3 feels cramped on small phones (390pt width test)

---

## EPIC-UX-04: Brief Detail & History

### US-UX-04-01: Brief detail reading experience `P0`

**As** Sam,  
**I want** a comfortable reading layout for the full brief,  
**So that** I can review KPIs and narrative without clutter.

**Acceptance criteria:**
- [ ] Headline + date + full narrative with comfortable line height (1.45–1.5)
- [ ] KPI deltas rendered as scannable chips or compact table
- [ ] Top action repeated with clear CTA
- [ ] Footer actions: "Ask about this brief" · "Share" (if supported)

---

### US-UX-04-02: Brief history list `P1`

**As** Grace,  
**I want** to browse past briefs by date,  
**So that** I compare weeks quickly.

**Acceptance criteria:**
- [x] Reverse-chronological list with date + headline snippet
- [x] Unread or "significant delta" days optionally badged
- [x] Tap row opens `/brief/:date`
- [x] Empty state: "Briefs appear after your first scheduled run"

---

## EPIC-UX-05: Actions Tab (Recommendations)

### US-UX-05-01: Recommendations feed hierarchy `P0`

**As** Grace,  
**I want** recommendations ranked by impact,  
**So that** I tackle what matters first.

**Acceptance criteria:**
- [x] Screen title + subtitle ("Ranked by estimated impact")
- [x] Each card: category pill · title · impact range · 2-line body
- [x] Primary card actions: Accept · Dismiss (or swipe affordance documented)
- [x] Loading skeleton: 3 card placeholders

---

### US-UX-05-02: Recommendation detail layout `P0`

**As** Sam,  
**I want** evidence and steps on the detail screen,  
**So that** I trust the recommendation before acting.

**Acceptance criteria:**
- [x] Hero: title + impact magnitude + confidence indicator if available
- [x] Sections: Why · Evidence · Suggested steps (collapsible after first section)
- [x] Sticky bottom bar: Accept (primary) · Dismiss (ghost)
- [x] Link to related alert or profit leak when `metric_snapshot` references exist

---

### US-UX-05-03: Empty and caught-up states `P1`

**As** Sam,  
**I want** a clear empty state when there are no actions,  
**So that** I know Morgan is monitoring, not broken.

**Acceptance criteria:**
- [x] Empty copy: "No actions right now — Morgan will surface opportunities as data syncs"
- [x] Illustration-free; optional subtle icon in accent-muted circle
- [x] CTA: "Ask Morgan what to focus on" → `/chat`

---

## EPIC-UX-06: Ask Tab (Chat)

### US-UX-06-01: Chat layout and input bar `P0`

**As** Sam,  
**I want** a familiar chat UI optimised for finance questions,  
**So that** asking Morgan feels as easy as texting.

**Acceptance criteria:**
- [x] Message list: user right-aligned bubble · Morgan left-aligned surface bubble
- [x] Input bar fixed bottom with send button; respects keyboard inset
- [x] Starter chips above input on empty thread (from brief context when available)
- [x] Max bubble width ~85% screen; code/currency monospace where needed

---

### US-UX-06-02: Citations and action cards in chat `P0`

**As** Fiona,  
**I want** citations and action cards inline,  
**So that** I verify numbers and act without leaving chat.

**Acceptance criteria:**
- [x] Citation chips tappable → bottom sheet with source + date range
- [x] Action cards use compact card pattern matching recommendations
- [x] Scenario cards visually distinct but same dark surface system
- [x] Loading: typing indicator (three-dot pulse) within 500ms of send

---

### US-UX-06-03: Chat error and retry `P1`

**As** Sam,  
**I want** clear errors when chat fails,  
**So that** I can retry without losing my question.

**Acceptance criteria:**
- [x] Inline error bubble with "Retry" button
- [x] User message preserved on failure
- [x] Offline banner at top when no connectivity

---

## EPIC-UX-07: Alerts Tab

### US-UX-07-01: Alerts feed layout `P0`

**As** Grace,  
**I want** alerts sorted by severity and recency,  
**So that** I react to critical issues first.

**Acceptance criteria:**
- [x] Unread section above read (or visual weight difference)
- [x] Each row: severity stripe (left border) · title · magnitude · relative time
- [x] Severity colours: critical (loss tone) · warning (warning tone) · info (muted accent)
- [x] Tap opens `/alerts/:id`; swipe or button to mark read

---

### US-UX-07-02: Alert detail with CTAs `P0`

**As** Grace,  
**I want** every alert to tell me what happened and what to do,  
**So that** alerts are actionable not alarming.

**Acceptance criteria:**
- [x] Title + body + magnitude + top driver field visible without scroll
- [x] Metric snapshot in collapsible "Details" section
- [x] Primary CTA from `links` (brief · chat · marketing · recommendation)
- [x] Secondary: Mark read · Dismiss (if product allows)

---

### US-UX-07-03: Alert type visual language `P1`

**As** the system,  
**I want** consistent iconography per alert type,  
**So that** merchants recognise margin vs refund vs stockout alerts.

**Acceptance criteria:**
- [x] Types mapped: `margin_drop`, `ad_waste`, `stockout_risk`, `cash_crunch`, `refund_spike`, `profit_leak`
- [x] Icon + label in list and detail header
- [x] Document mapping in code comment or design token file

---

## EPIC-UX-08: Settings & Configuration

### US-UX-08-01: Settings hub structure `P0`

**As** Sam,  
**I want** settings grouped logically,  
**So that** I find finance and integrations quickly.

**Acceptance criteria:**
- [x] Sections: FINANCE · INTEGRATIONS · NOTIFICATIONS · DEVELOPER (dev only)
- [x] Each row: title + subtitle (current value) + chevron
- [x] Uses inset grouped list pattern on `MorganSurface`
- [x] Profile/store name header with shop domain subtitle

---

### US-UX-08-02: Finance settings screens `P0`

**As** Grace,  
**I want** COGS, briefing schedule, and target margin screens to feel consistent,  
**So that** configuration is predictable.

**Acceptance criteria:**
- [x] Shared pattern: screen title · 1-line explainer · form surface · primary Save
- [x] COGS: method picker cards with selected state border accent
- [x] Briefing: time picker + timezone with next-run preview
- [x] Target margin: slider + numeric input synced; live preview text
- [x] Recalculation banner on COGS matches design system (non-blocking)

---

### US-UX-08-03: Notification preferences `P1`

**As** Sam,  
**I want** toggles grouped by notification type,  
**So that** I control push noise.

**Acceptance criteria:**
- [x] Group: Daily brief · Warnings · Critical · Quiet hours · Weekly digest
- [x] Each toggle row: label + short description
- [x] Quiet hours: start/end pickers inline
- [x] Save implicit on toggle (no extra save button) or explicit Save if batch API

---

## EPIC-UX-09: Profit Dashboard

### US-UX-09-01: Profit hero and target progress `P0`

**As** Grace,  
**I want** contribution margin and progress to target above the fold,  
**So that** I know if I'm hitting my goal.

**Acceptance criteria:**
- [x] Hero metric card: current margin % + delta + target subtitle
- [x] `MarginTargetProgress` bar with % of target label
- [x] Below-target badge visible but not overwhelming (compact pill)
- [x] Tap hero opens margin drivers sheet

---

### US-UX-09-02: Profit sections order and density `P0`

**As** Fiona,  
**I want** profit leaks and SKU ranking in a logical scroll order,  
**So that** I diagnose issues top-to-bottom.

**Acceptance criteria:**
- [x] Order: Overview metrics → Target progress → Forecast (if any) → Pricing suggestions → Leaks → SKU ranking
- [ ] Each section: `MorganSectionHeader` + optional "See all"
- [ ] Charts min height 120pt; axis labels readable on small phones
- [x] Skeleton loaders per section on first load

---

### US-UX-09-03: Profit leak and SKU detail sheets `P1`

**As** Grace,  
**I want** detail views as sheets or full screens with shared chrome,  
**So that** deep dives feel part of the same app.

**Acceptance criteria:**
- [x] Leak detail: amount at risk · evidence bullets · suggested fix CTA
- [x] SKU detail: margin · velocity · return rate · trend sparkline
- [x] Shared app bar: back + SKU/leak title truncated

---

## EPIC-UX-10: Cash Overview

### US-UX-10-01: Cash runway hero `P0`

**As** Sam,  
**I want** runway days as the hero number,  
**So that** cash stress is obvious immediately.

**Acceptance criteria:**
- [x] Hero: runway days + status label (Healthy / Watch / Critical)
- [x] Secondary: current balance · avg daily burn
- [x] Status colour uses semantic tokens (not arbitrary)
- [x] Bank-not-connected state: CTA to Integrations, not empty chart

---

### US-UX-10-02: Cash reconciliation panel `P1`

**As** Fiona,  
**I want** unmatched transactions accessible but not noisy,  
**So that** I fix reconciliation when needed.

**Acceptance criteria:**
- [x] Unmatched count badge on section header
- [x] Tap → `/cash/unmatched` list with amount · date · suggested match
- [x] List rows tappable; empty state when all matched

---

## EPIC-UX-11: Marketing Overview

### US-UX-11-01: Marketing tabbed layout `P0`

**As** Grace,  
**I want** POAS and MER in clear tabs,  
**So that** I compare channels without confusion.

**Acceptance criteria:**
- [x] Tab bar: POAS · MER · Budget (or existing tab structure preserved)
- [x] Each tab: hero metric + 7d trend chart + campaign list
- [x] Campaign rows: name · spend · POAS/MER · tap → campaign detail
- [x] Meta-not-connected: inline connect CTA card

---

### US-UX-11-02: Campaign detail chart `P1`

**As** Grace,  
**I want** campaign detail with trend and recommendation link,  
**So that** I decide pause vs scale in one screen.

**Acceptance criteria:**
- [x] Header: campaign name + channel pill
- [x] 7d line chart with spend and POAS series
- [x] Action strip if ad-waste alert or recommendation exists

---

## EPIC-UX-12: Inventory Overview

### US-UX-12-01: Inventory health summary `P0`

**As** Sam,  
**I want** stockout risk visible at a glance,  
**So that** I reorder before losing sales.

**Acceptance criteria:**
- [x] Summary tiles: SKUs at risk · Total SKUs · Avg days of cover
- [x] SKU list sorted by risk or revenue (toggle or fixed rule documented)
- [x] Row: SKU · days of stock · velocity · tap → SKU detail
- [x] Low-confidence badge uses warning muted style

---

### US-UX-12-02: Inventory SKU detail `P1`

**As** Sam,  
**I want** SKU detail with lead time and reorder hint,  
**So that** I act on inventory recommendations.

**Acceptance criteria:**
- [x] Hero: days of stock + lead time comparison
- [x] Chart: velocity trend if available
- [x] CTA: "Plan reorder" → scenario or recommendation when linked

---

## EPIC-UX-13: Integrations Hub

### US-UX-13-01: Integration cards unified design `P0`

**As** Sam,  
**I want** every integration to look and behave the same,  
**So that** I manage connections confidently.

**Acceptance criteria:**
- [x] Card: provider logo/name · status pill · last sync · coverage bar
- [x] States: Connected · Error · Reconnect needed · Coming soon
- [x] Error shows human message + Reconnect primary button
- [x] Coming soon: badge only; CTAs hidden

---

### US-UX-13-02: Account mapping screens (QBO / Xero) `P1`

**As** Fiona,  
**I want** mapping screens that feel like settings, not a different app,  
**So that** accounting setup is trustworthy.

**Acceptance criteria:**
- [x] Explainer paragraph at top (≤ 3 lines)
- [x] Mapping rows: Morgan field · account picker dropdown
- [x] Save fixed bottom or app bar action
- [x] Validation errors inline per row

---

## EPIC-UX-14: Scenario Planner

### US-UX-14-01: Scenario input form `P1`

**As** Grace,  
**I want** scenario inputs to be simple sliders and fields,  
**So that** I model decisions without a spreadsheet.

**Acceptance criteria:**
- [x] Scenario type selector at top (ad spend · inventory · pricing)
- [x] Inputs grouped in one `MorganSurface`
- [x] Run scenario primary button; results replace form area below
- [x] Results: headline outcome + 2–3 supporting metrics

---

## EPIC-UX-16: Secondary & Detail Screens

> Screens reached from tabs or deep links — must match the same dark surface system as tabs.

### US-UX-16-01: Unified deep-route app bar `P0`

**As** Sam,  
**I want** every pushed screen to share the same header pattern,  
**So that** back navigation and titles feel consistent.

**Implement in:** All `*_screen.dart` with `AppBar`; consider shared `MorganDetailScaffold`

**Acceptance criteria:**
- [x] Background `palette.background`; elevation 0; title `titleMedium`
- [x] Back chevron returns to sensible parent (not blank pop)
- [x] Share/actions in app bar use icon-only with tooltips
- [x] Screens: profit, cash, marketing, inventory, brief detail/history, recommendation detail, alert detail

---

### US-UX-16-02: Recommendation detail polish `P0`

**As** Grace,  
**I want** the recommendation detail screen to match Actions tab cards,  
**So that** accepting an action feels continuous.

**Implement in:** `recommendation_detail_screen.dart`

**Acceptance criteria:**
- [x] Same card surfaces as feed; sticky Accept / Dismiss bar
- [x] Impact range in `palette.profit` or `palette.warning` by magnitude
- [x] Evidence section collapsible; Why section always visible
- [x] No raw JSON or debug fields visible

---

### US-UX-16-03: Alert detail polish `P0`

**As** Grace,  
**I want** alert detail to lead with magnitude and CTA,  
**So that** I act before reading every field.

**Implement in:** `alert_detail_screen.dart`

**Acceptance criteria:**
- [x] Severity stripe + icon + type label in header block
- [x] Primary CTA button full-width above fold
- [x] Metric snapshot in collapsed `ExpansionTile` or "Details" section
- [x] Refund spike / margin drop / ad waste use US-UX-07-03 icon map

---

### US-UX-16-04: Profit leak & SKU detail `P1`

**As** Fiona,  
**I want** profit deep dives to reuse metric and chart styling from the dashboard,  
**So that** I trust the numbers match.

**Implement in:** `profit_leak_detail_screen.dart`, `sku_detail_screen.dart`

**Acceptance criteria:**
- [x] Hero metric: amount at risk or margin % with semantic colour
- [x] Evidence as bullet list on `MorganSurface`, not plain `Text` wall
- [x] Sparkline/chart uses same colours as `margin_trend_chart.dart`
- [x] CTA links to recommendation or scenario when available

---

### US-UX-16-05: Campaign & inventory SKU detail `P1`

**As** Grace,  
**I want** marketing and inventory detail screens to mirror their overview tabs,  
**So that** drill-down feels familiar.

**Implement in:** `campaign_detail_screen.dart`, `inventory_sku_detail_screen.dart`

**Acceptance criteria:**
- [x] Reuse overview row/chart components where possible
- [x] Channel or risk pill in header
- [x] Ad-waste or stockout CTA when linked alert exists

---

### US-UX-16-06: Cash unmatched list `P1`

**As** Fiona,  
**I want** unmatched transactions in a scannable list,  
**So that** reconciliation is quick.

**Implement in:** `cash_unmatched_screen.dart`

**Acceptance criteria:**
- [x] Row: date · amount · counterparty · match suggestion
- [x] Amount outflows in `palette.loss`
- [x] Empty state when zero unmatched
- [x] Consistent with US-UX-10-02 overview entry point

---

### US-UX-16-07: Notification & inventory settings forms `P1`

**As** Sam,  
**I want** secondary settings screens to match finance settings layout,  
**So that** I configure the app in one visual language.

**Implement in:** `notification_settings_screen.dart`, `inventory_settings_screen.dart`

**Acceptance criteria:**
- [x] Same pattern as `target_margin_screen.dart`: explainer · form surface · save
- [x] Toggles use theme switch colours (accent when on)
- [x] Errors inline in `palette.loss`

---

## EPIC-UX-15: Cross-Cutting UX

### US-UX-15-01: Skeleton loading pattern `P0`

**As** Sam,  
**I want** skeleton placeholders instead of spinners,  
**So that** the app feels fast even while loading.

**Acceptance criteria:**
- [x] Shared shimmer/skeleton widget matching dark surfaces
- [x] Applied to: Home brief, Recommendations list, Alerts list, Profit overview
- [x] Full-screen spinner only for auth and initial app bootstrap

---

### US-UX-15-02: Empty states catalogue `P0`

**As** the system,  
**I want** consistent empty states everywhere,  
**So that** merchants never see a blank white box.

**Acceptance criteria:**
- [x] Pattern: muted icon area · title · 1-line explanation · optional CTA
- [x] All list screens audited: brief history, recommendations, alerts, SKU lists
- [x] Copy tone: helpful, not apologetic

---

### US-UX-15-03: Error states and retry `P0`

**As** Sam,  
**I want** errors that tell me what to do,  
**So that** I'm not stuck after a failed load.

**Acceptance criteria:**
- [x] Pattern: short message + Retry button
- [x] Network errors distinguish from 4xx/5xx where possible
- [x] Snackbars for save failures (settings, dismiss recommendation)
- [x] No raw exception text shown to merchants

---

### US-UX-15-04: Motion and haptics `P1`

**As** Grace,  
**I want** subtle motion on key interactions,  
**So that** the app feels responsive and premium.

**Acceptance criteria:**
- [x] Tab switch: `MorganDuration.fast` cross-fade or none (no slow transitions)
- [x] List item appear: optional `MorganFadeIn` stagger ≤ 300ms total
- [x] Accept recommendation / mark alert read: light haptic (iOS/Android)
- [x] Respect reduced-motion OS setting

---

### US-UX-15-05: Accessibility pass `P1`

**As** Marcus,  
**I want** Morgan usable with VoiceOver and large text,  
**So that** my team can use the app inclusively.

**Acceptance criteria:**
- [x] All icon-only buttons have `Semantics` labels
- [x] Touch targets ≥ 44pt
- [x] Contrast ratio ≥ 4.5:1 for body text on dark surfaces
- [x] Charts have text alternatives (summary line above chart)
- [x] Screen reader order matches visual order on home and alerts

---

### US-UX-15-06: Performance budget (perceived speed) `P0`

**As** the system,  
**I want** first meaningful paint under 2 seconds on mid-range devices,  
**So that** Morgan feels instant.

**Acceptance criteria:**
- [x] Home brief shows cached content immediately when available; refresh in background
- [x] Images/logos asset-optimised; no oversized PNGs
- [x] List views use builder constructors; no unbounded shrink-wrap lists
- [x] Measure cold start and tab switch in profile mode; document baseline in PR

---

## Implementation Order

Work top-to-bottom. Update the [backlog table](#implementation-backlog) status as you ship.

| Phase | Stories | Outcome | Suggested PR scope |
|-------|---------|---------|-------------------|
| **1 — Foundation** | US-UX-00-01 … 00-05, US-UX-15-01 … 15-03 | Dark theme, tokens, skeletons, errors | One PR: theme audit + `MorganSkeleton` widget |
| **2 — Brief loop** | US-UX-03-01 … 03-07, US-UX-04-01, US-UX-01-01 … 01-02 | Daily habit polished | US-UX-04-01 brief detail polish |
| **3 — Intelligence tabs** | US-UX-05-01 … 05-03, US-UX-06-01 … 06-03, US-UX-07-01 … 07-03 | Actions, Ask, Alerts | One PR per tab |
| **4 — Money surfaces** | US-UX-09 … 12, US-UX-16-04 … 16-06 | Profit, Cash, Marketing, Inventory | One PR per surface |
| **5 — Settings & integrations** | US-UX-08, US-UX-13, US-UX-14, US-UX-16-07 | Configuration trust | Settings hub, then integrations |
| **6 — Polish** | US-UX-15-04 … 15-06, US-UX-01-03, US-UX-16-01 | Motion, a11y, deep routes | Cross-cutting PR |

### If you are starting today

**Already done (Brief):** US-UX-03-01 … 03-07 — home brief hero, KPI strip, action card, quick links.

**Next three stories to pick up:**

1. **US-UX-04-01** — Brief detail screen polish (share, full narrative, offline)
2. **US-UX-09-02** — Profit "See all" links + margin trend chart min-height (remaining AC)
3. **US-UX-01-03** — Deep route headers and back navigation consistency

---

## UX Definition of Done

A UX story is **Done** when:

- [ ] Acceptance criteria checked on **iOS and Android** simulators (phone size 390×844 minimum)
- [ ] Uses theme tokens only (`context.morgan`, `MorganSpace`, `MorganRadius`)
- [ ] Widget test or golden screenshot for primary layout (hero + one interaction)
- [ ] No regression to light theme if light mode still exists in code
- [ ] Product review: **scan test** — stakeholder identifies hero metric in ≤ 3 seconds
- [ ] Linked feature story (if any) still passes functional AC

---

*Document version: 1.1 — June 2026*  
*Project: Morgan Mobile UX · Implementation backlog with file map*
