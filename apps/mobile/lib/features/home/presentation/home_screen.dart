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
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_metric_card.dart';

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
                  child: briefAsync.when(
                    loading: () => Row(
                      children: [
                        const MorganLogo(size: 36),
                        const Spacer(),
                        Text(
                          'Today',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                    error: (_, __) => Row(
                      children: [
                        const MorganLogo(size: 36),
                        const Spacer(),
                        Text('Today', style: theme.textTheme.bodySmall),
                      ],
                    ),
                    data: (brief) => Row(
                      children: [
                        const MorganLogo(size: 36),
                        TextButton(
                          onPressed: () => context.push('/brief/history'),
                          child: const Text('History'),
                        ),
                        const Spacer(),
                        Text(
                          formatBriefingDateLabel(brief),
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    briefAsync.when(
                      loading: () => const MorganFadeIn(
                        child: _HomeKpiRow.loading(),
                      ),
                      error: (_, __) => const MorganFadeIn(
                        child: _HomeKpiRow.placeholder(),
                      ),
                      data: (brief) => MorganFadeIn(
                        child: _HomeKpiRow(
                          brief: brief,
                          runwayAsync: runwayAsync,
                        ),
                      ),
                    ),
                    const SizedBox(height: MorganSpace.lg),
                    briefAsync.when(
                      loading: () => const MorganFadeIn(
                        child: MorganBriefCard(
                          dateLabel: 'Today',
                          headline: 'Loading your briefing',
                          narrative: '',
                        ),
                      ),
                      error: (error, _) => MorganFadeIn(
                        child: MorganBriefCard(
                          dateLabel: 'Today',
                          headline: 'Brief unavailable',
                          narrative: error.toString(),
                        ),
                      ),
                      data: (brief) => MorganFadeIn(
                        child: MorganBriefCard(
                          dateLabel: brief.hasBrief ? formatBriefingDateLabel(brief) : 'Today',
                          headline: brief.hasBrief
                              ? brief.headline
                              : 'Your first briefing is on the way',
                          narrative: brief.hasBrief ? brief.narrative : '',
                          isEmpty: !brief.hasBrief,
                          emptyMessage: brief.hasBrief
                              ? null
                              : 'Your first briefing arrives by ${formatNextBriefingDateTime(brief)}.',
                        ),
                      ),
                    ),
                    const SizedBox(height: MorganSpace.lg),
                    briefAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (brief) {
                        final action = brief.topAction;
                        if (!brief.hasBrief || action == null) return const SizedBox.shrink();

                        final impact = formatImpactRange(action);
                        return MorganFadeIn(
                          delay: const Duration(milliseconds: 80),
                          child: MorganActionCard(
                            title: action.title,
                            body: action.body,
                            impact: impact.isEmpty ? null : impact,
                            onReview: () {
                              if (action.category == 'ad_waste' || action.category == 'marketing') {
                                context.push('/marketing');
                                return;
                              }
                              if (action.category == 'setup') {
                                context.push('/settings');
                              }
                            },
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: MorganSpace.huge),
                  ]),
                ),
              ),
            ],
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

  const _HomeKpiRow.loading()
      : brief = null,
        runwayAsync = null;

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
          Expanded(child: MorganMetricCard(label: 'Profit', value: '—')),
          SizedBox(width: MorganSpace.sm),
          Expanded(child: MorganMetricCard(label: 'Cash runway', value: '—')),
          SizedBox(width: MorganSpace.sm),
          Expanded(child: MorganMetricCard(label: 'MER', value: '—')),
        ],
      );
    }

    final profit = findKpiDelta(brief!, 'contribution_margin_7d');
    final mer = findKpiDelta(brief!, 'mer_7d') ?? findKpiDelta(brief!, 'poas_7d');
    final runway = runwayAsync?.valueOrNull;

    return Row(
      children: [
        Expanded(
          child: MorganMetricCard(
            label: 'Profit',
            value: profit == null ? '—' : formatKpiValue(profit),
            delta: formatKpiDelta(profit),
            trend: kpiTrend(profit, higherIsBetter: true),
            onTap: () => context.push('/profit'),
          ),
        ),
        const SizedBox(width: MorganSpace.sm),
        Expanded(
          child: MorganMetricCard(
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
            label: brief!.metaConnected ? 'MER' : 'Marketing',
            value: brief!.metaConnected
                ? (mer == null ? '—' : formatKpiValue(mer))
                : 'Connect',
            delta: brief!.metaConnected ? formatKpiDelta(mer) : null,
            trend: brief!.metaConnected
                ? kpiTrend(mer, higherIsBetter: false)
                : null,
            subtitle: brief!.metaConnected ? null : 'Link Meta for MER',
            onTap: () => context.push('/marketing'),
          ),
        ),
      ],
    );
  }
}
