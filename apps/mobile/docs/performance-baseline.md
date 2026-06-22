# Morgan mobile — performance baseline

Perceived-speed budget for **US-UX-15-06**. Targets apply to mid-range devices (e.g. iPhone 12 / Pixel 5 class) in **profile mode**.

| Metric | Target | Notes |
|--------|--------|-------|
| First meaningful paint (home brief visible) | **< 2 s** cold start | Cached brief should appear on first frame after auth |
| Tab switch (shell) | **< 150 ms** | Matches `MorganDuration.fast` cross-fade |
| Pull-to-refresh | No skeleton flash | Stale brief stays visible while network fetch runs |

## How to measure

### Cold start → home brief

1. Build profile: `flutter build apk --profile` (Android) or `flutter build ios --profile` (iOS).
2. Install on a physical device; sign in so today’s brief is cached.
3. Force-quit the app.
4. Run with timeline:  
   `flutter run --profile --trace-startup`
5. In DevTools **Performance**, mark time from process start until the brief headline `Text` first paints.
6. Repeat 5 runs; record **p50** and **p95**.

### Tab switch

1. With the app running in profile mode, open DevTools Performance.
2. Record while tapping Brief → Actions → Ask → Alerts → Settings → Brief.
3. Measure frame time for the first frame after each tap until the new tab body is stable.
4. Record **p50** tab-switch latency (exclude intentional 150 ms fade if measuring “interactive”).

### Baseline template (fill after local run)

| Run | Device | OS | Cold start FMP (ms) | Tab switch p50 (ms) | Date |
|-----|--------|----|---------------------|---------------------|------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| **p50** | | | | | |

## Implementation notes (this story)

### Cached brief (stale-while-revalidate)

- `SharedPreferences` is initialised in `main()` via `sharedPreferencesProvider`.
- `DailyBriefNotifier` returns cached brief synchronously from disk, then calls the API in the background.
- Pull-to-refresh uses `refresh()` which **does not** clear visible brief when cache exists.
- Home uses `briefAsync.valueOrNull` so skeletons never replace a visible cached brief.

### Assets

- In-app **Morgan logomark** is `CustomPaint` (`morgan_logo.dart`) — no raster logo in `pubspec.yaml`.
- Raster assets are **launcher icons only** (platform `mipmap-*` / `AppIcon.appiconset`); none are loaded at runtime in UI.
- Do not add large PNGs to `flutter/assets`; prefer vector/`CustomPaint` or appropriately sized WebP if raster is required.

### List builders

- **Home:** `SliverChildBuilderDelegate` (fixed section count); quick links use a 2×2 `Row`/`Column` layout (no shrink-wrap `GridView`).
- **Alerts:** `SliverList.builder` for unread and read sections.
- **Recommendations / brief history:** already use `SliverChildBuilderDelegate` / `ListView.separated`.

Avoid `ListView(children: [...])` or `GridView` with `shrinkWrap: true` inside scroll views for unbounded feeds.

## Regression checklist

- [ ] Cold start with cached brief: headline visible without skeleton flash
- [ ] Pull-to-refresh: brief stays on screen during fetch
- [ ] Alerts list scrolls smoothly with 50+ items (builder path)
- [ ] No new raster assets > 100 KB in `pubspec` assets
