import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/brief/brief_formatters.dart';
import '../../../core/brief/brief_repository.dart';
import '../../../core/cash/cash_repository.dart';
import '../../../core/metrics/metrics_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_action_card.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_skeleton.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Future<void> _handleRefresh() async {
    await ref.read(dailyBriefProvider.notifier).refresh();
    ref.invalidate(storeMetricsProvider);
    ref.invalidate(cashRunwayProvider);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final briefAsync = ref.watch(dailyBriefProvider);
    final runwayAsync = ref.watch(cashRunwayProvider);
    final cachedBrief = briefAsync.valueOrNull;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _handleRefresh,
          color: p.accent,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    MorganSpace.screenH,
                    MorganSpace.md,
                    MorganSpace.screenH,
                    MorganSpace.xs,
                  ),
                  child: Row(
                    children: [
                      const MorganLogo(size: 36),
                      TextButton(
                        onPressed: () => context.push('/brief/history'),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(44, 44),
                          tapTargetSize: MaterialTapTargetSize.padded,
                        ),
                        child: const Text('History'),
                      ),
                      const Spacer(),
                      _HomeDateLabel(briefAsync: briefAsync, theme: theme),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      switch (index) {
                        case 0:
                          return _HomeBriefSection(
                            briefAsync: briefAsync,
                            onRetry: _handleRefresh,
                          );
                        case 1:
                          return const SizedBox(height: MorganSpace.lg);
                        case 2:
                          return _HomeKpiSection(
                            briefAsync: briefAsync,
                            runwayAsync: runwayAsync,
                          );
                        case 3:
                          return const SizedBox(height: MorganSpace.lg);
                        case 4:
                          return const MorganFadeIn(
                            delay: Duration(milliseconds: 70),
                            child: _HomeQuickLinks(),
                          );
                        case 5:
                          return const SizedBox(height: MorganSpace.lg);
                        case 6:
                          if (cachedBrief == null ||
                              !cachedBrief.hasBrief ||
                              cachedBrief.topAction == null) {
                            return const SizedBox.shrink();
                          }
                          final action = cachedBrief.topAction!;
                          final impact = formatImpactAtRisk(action);
                          final route = topActionRoute(action);
                          return MorganFadeIn(
                            delay: const Duration(milliseconds: 80),
                            child: MorganActionCard(
                              title: action.title,
                              body: action.body,
                              impact: impact.isEmpty ? null : impact,
                              onReview: route == null ? null : () => context.push(route),
                              onAskMorgan: () {
                                final prompt = topActionChatPrompt(action);
                                context.push('/chat?prompt=${Uri.encodeComponent(prompt)}');
                              },
                            ),
                          );
                        case 7:
                          return const SizedBox(height: MorganSpace.huge);
                        default:
                          return null;
                      }
                    },
                    childCount: 8,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeDateLabel extends StatelessWidget {
  const _HomeDateLabel({required this.briefAsync, required this.theme});

  final AsyncValue<DailyBrief> briefAsync;
  final TextTheme theme;

  @override
  Widget build(BuildContext context) {
    final brief = briefAsync.valueOrNull;
    if (brief != null) {
      return Text(formatBriefingDateLabel(brief), style: theme.bodySmall);
    }
    if (briefAsync.isLoading) {
      return const MorganShimmer(child: MorganSkeletonBox(width: 96, height: 14));
    }
    return Text('Today', style: theme.bodySmall);
  }
}

class _HomeBriefSection extends StatelessWidget {
  const _HomeBriefSection({required this.briefAsync, required this.onRetry});

  final AsyncValue<DailyBrief> briefAsync;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final brief = briefAsync.valueOrNull;
    if (brief != null) {
      return MorganFadeIn(
        child: MorganBriefCard(
          dateLabel: brief.hasBrief ? formatBriefingDateLabel(brief) : 'Today',
          headline: brief.hasBrief ? brief.headline : 'Your first briefing is on the way',
          narrative: brief.hasBrief ? brief.narrative : '',
          isEmpty: !brief.hasBrief,
          emptyMessage: brief.hasBrief
              ? null
              : 'Your first briefing arrives by ${formatNextBriefingDateTime(brief)}.',
          headlineMaxLines: briefHeadlineHomeMaxLines,
          narrativeMaxLines: brief.hasBrief ? briefNarrativeHomeMaxLines : null,
        ),
      );
    }
    if (briefAsync.isLoading) {
      return const MorganFadeIn(child: MorganBriefCardSkeleton());
    }
    return MorganFadeIn(
      child: MorganErrorState(
        error: briefAsync.error,
        fallbackMessage: 'Could not load today\'s brief.',
        onRetry: onRetry,
        compact: true,
        centered: false,
      ),
    );
  }
}

class _HomeKpiSection extends StatelessWidget {
  const _HomeKpiSection({required this.briefAsync, required this.runwayAsync});

  final AsyncValue<DailyBrief> briefAsync;
  final AsyncValue<CashRunway> runwayAsync;

  @override
  Widget build(BuildContext context) {
    final brief = briefAsync.valueOrNull;
    if (brief != null) {
      return MorganFadeIn(
        delay: const Duration(milliseconds: 60),
        child: _HomeKpiRow(brief: brief, runwayAsync: runwayAsync),
      );
    }
    if (briefAsync.isLoading) {
      return const MorganFadeIn(child: MorganKpiRowSkeleton());
    }
    return const MorganFadeIn(child: _HomeKpiRow.placeholder());
  }
}

class _HomeQuickLinks extends StatelessWidget {
  const _HomeQuickLinks();

  static const _links = [
    (Icons.trending_up_rounded, 'Profit', '/profit'),
    (Icons.account_balance_wallet_outlined, 'Cash', '/cash'),
    (Icons.campaign_outlined, 'Marketing', '/marketing'),
    (Icons.inventory_2_outlined, 'Inventory', '/inventory'),
  ];

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Column(
      children: [
        for (var row = 0; row < 2; row++) ...[
          if (row > 0) const SizedBox(height: MorganSpace.sm),
          Row(
            children: [
              for (var col = 0; col < 2; col++) ...[
                if (col > 0) const SizedBox(width: MorganSpace.sm),
                Expanded(child: _HomeQuickLinkTile(link: _links[row * 2 + col], p: p, theme: theme)),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _HomeQuickLinkTile extends StatelessWidget {
  const _HomeQuickLinkTile({required this.link, required this.p, required this.theme});

  final (IconData, String, String) link;
  final MorganPalette p;
  final TextTheme theme;

  @override
  Widget build(BuildContext context) {
    final (icon, label, route) = link;

    return Semantics(
      button: true,
      label: label,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Material(
          color: p.surfaceMuted,
          borderRadius: BorderRadius.circular(MorganRadius.md),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => context.push(route),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MorganSpace.sm),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 22, color: p.textPrimary),
                  const SizedBox(height: MorganSpace.xxs),
                  Text(label, style: theme.labelLarge),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeKpiRow extends StatelessWidget {
  const _HomeKpiRow({
    required this.brief,
    required this.runwayAsync,
  });

  const _HomeKpiRow.placeholder()
      : brief = null,
        runwayAsync = null;

  final DailyBrief? brief;
  final AsyncValue<CashRunway>? runwayAsync;

  @override
  Widget build(BuildContext context) {
    if (brief == null) {
      return const Row(
        children: [
          Expanded(
            child: MorganMetricCard(compact: true, label: 'Profit', value: '—'),
          ),
          SizedBox(width: MorganSpace.sm),
          Expanded(
            child: MorganMetricCard(compact: true, label: 'Cash runway', value: '—'),
          ),
          SizedBox(width: MorganSpace.sm),
          Expanded(
            child: MorganMetricCard(compact: true, label: 'MER', value: '—'),
          ),
        ],
      );
    }

    final p = context.morgan;
    final profit = findKpiDelta(brief!, 'contribution_margin_7d');
    final mer = findKpiDelta(brief!, 'mer_7d') ?? findKpiDelta(brief!, 'poas_7d');
    final runway = runwayAsync?.valueOrNull;
    final profitTrend = kpiTrend(profit, higherIsBetter: true);
    final merTrend = kpiTrend(mer, higherIsBetter: false);

    return Row(
      children: [
        Expanded(
          child: MorganMetricCard(
            compact: true,
            label: 'Profit',
            value: profit == null ? '—' : formatKpiValue(profit),
            delta: formatKpiDelta(profit),
            trend: profitTrend,
            valueColor: profitTrend == MetricTrend.down ? p.loss : null,
            onTap: () => context.push('/profit'),
          ),
        ),
        const SizedBox(width: MorganSpace.sm),
        Expanded(
          child: MorganMetricCard(
            compact: true,
            label: 'Cash runway',
            value: runway?.displayValue ?? '—',
            subtitle: runway?.bankConnected == true
                ? 'Based on 30-day outflow'
                : 'Connect bank for forecast',
            onTap: () => context.push('/cash'),
          ),
        ),
        const SizedBox(width: MorganSpace.sm),
        Expanded(
          child: MorganMetricCard(
            compact: true,
            label: brief!.metaConnected ? 'MER' : 'Marketing',
            value: brief!.metaConnected
                ? (mer == null ? '—' : formatKpiValue(mer))
                : 'Connect',
            delta: brief!.metaConnected ? formatKpiDelta(mer) : null,
            trend: brief!.metaConnected ? merTrend : null,
            valueColor: brief!.metaConnected && merTrend == MetricTrend.down ? p.loss : null,
            subtitle: brief!.metaConnected ? null : 'Link Meta for MER',
            onTap: () => context.push('/marketing'),
          ),
        ),
      ],
    );
  }
}
