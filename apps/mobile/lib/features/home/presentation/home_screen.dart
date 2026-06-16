import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/sync/sync_providers.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_action_card.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final today = DateFormat('EEEE, MMM d').format(DateTime.now());
    final syncStatus = ref.watch(syncStatusProvider);

    final showEmptyState = syncStatus.maybeWhen(
      data: (status) => !status.isBriefReady,
      orElse: () => true,
    );

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: CustomScrollView(
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
                    const Spacer(),
                    Text(today, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (showEmptyState) ...[
                    MorganFadeIn(
                      child: MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Preparing your brief', style: theme.textTheme.titleLarge),
                            const SizedBox(height: MorganSpace.sm),
                            Text(
                              'Your first briefing arrives within 24 hours.',
                              style: theme.textTheme.bodyLarge,
                            ),
                            const SizedBox(height: MorganSpace.md),
                            syncStatus.when(
                              data: (status) => Text(
                                'Sync ${status.overallPercent}% complete',
                                style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
                              ),
                              loading: () => Text(
                                'Sync in progress…',
                                style: theme.textTheme.bodySmall,
                              ),
                              error: (_, e) => Text(
                                'Sync in progress…',
                                style: theme.textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ] else ...[
                    MorganFadeIn(
                      child: MorganBriefCard(
                        dateLabel: 'Today',
                        headline: 'Profit rose 12% on stronger margins',
                        narrative:
                            'Lower discounting and improved Meta POAS drove yesterday\'s gain. Cash runway unchanged until bank is connected.',
                      ),
                    ),
                    const SizedBox(height: MorganSpace.xl),
                    MorganFadeIn(
                      delay: const Duration(milliseconds: 60),
                      child: const MorganSectionHeader(title: 'Key metrics'),
                    ),
                    const SizedBox(height: MorganSpace.sm),
                    MorganFadeIn(
                      delay: const Duration(milliseconds: 100),
                      child: const Row(
                        children: [
                          Expanded(
                            child: MorganMetricCard(
                              label: 'Profit',
                              value: '\$4,280',
                              delta: '+12%',
                              trend: MetricTrend.up,
                            ),
                          ),
                          SizedBox(width: MorganSpace.sm),
                          Expanded(
                            child: MorganMetricCard(
                              label: 'MER',
                              value: '3.2',
                              delta: '+0.3',
                              trend: MetricTrend.up,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.sm),
                    MorganFadeIn(
                      delay: const Duration(milliseconds: 140),
                      child: MorganMetricCard(
                        label: 'Cash runway',
                        value: '—',
                        subtitle: 'Connect bank to unlock runway forecast',
                        onTap: () {},
                      ),
                    ),
                    const SizedBox(height: MorganSpace.xl),
                    MorganFadeIn(
                      delay: const Duration(milliseconds: 180),
                      child: MorganActionCard(
                        title: 'Reorder inventory',
                        body: 'Blue Tee (M) hits stockout risk in ~6 days.',
                        impact: 'Protect ~\$800 revenue',
                        onReview: () {},
                      ),
                    ),
                  ],
                  const SizedBox(height: MorganSpace.huge),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
