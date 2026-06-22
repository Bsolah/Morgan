import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/metrics/metrics_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../widgets/marketing_campaign_row.dart';
import '../widgets/marketing_meta_connect_card.dart';
import '../../../shared/widgets/morgan_info_tooltip.dart';
import '../widgets/mer_trend_chart.dart';

/// MER tab: hero · 7d trend · channel list (US-UX-11-01).
class MarketingMerTab extends ConsumerWidget {
  const MarketingMerTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final merAsync = ref.watch(marketingMerProvider);

    return merAsync.when(
      loading: () => const ListView(
        padding: EdgeInsets.all(MorganSpace.screenH),
        children: [MorganProfitSectionSkeleton(cardCount: 2)],
      ),
      error: (_, __) => ListView(
        padding: const EdgeInsets.all(MorganSpace.screenH),
        children: [
          Text('Could not load MER data.', style: theme.textTheme.bodySmall),
        ],
      ),
      data: (mer) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(
            MorganSpace.screenH,
            MorganSpace.md,
            MorganSpace.screenH,
            MorganSpace.huge,
          ),
          children: [
            if (!mer.metaConnected) ...[
              const MarketingMetaConnectCard(),
              const SizedBox(height: MorganSpace.lg),
            ],
            _MerHeroCard(
              mer: mer.blendedMer,
              tooltip: mer.merTooltip,
              windowDays: mer.windowDays,
            ),
            const SizedBox(height: MorganSpace.lg),
            const MorganSectionHeader(title: '7-day MER trend'),
            MorganSurface(
              child: MerTrendChart(points: mer.trend, trendDays: mer.trendDays),
            ),
            const SizedBox(height: MorganSpace.xl),
            const MorganSectionHeader(title: 'Channels'),
            MorganSurface(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: MorganSpace.card,
                      vertical: MorganSpace.sm,
                    ),
                    child: Row(
                      children: [
                        Expanded(child: Text('Name', style: theme.textTheme.labelSmall)),
                        SizedBox(
                          width: 56,
                          child: Text('Spend', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                        ),
                        const SizedBox(width: MorganSpace.sm),
                        SizedBox(
                          width: 52,
                          child: Text('MER', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                        ),
                        const SizedBox(width: 18),
                      ],
                    ),
                  ),
                  Divider(height: 1, color: p.borderSubtle),
                  ...mer.channels.map((channel) {
                    final isLast = channel == mer.channels.last;
                    return Column(
                      children: [
                        MarketingCampaignRow(
                          name: channel.label,
                          spend: channel.adSpend,
                          metricLabel: 'MER',
                          metricValue: formatMerRatio(channel.mer),
                        ),
                        if (!isLast) Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                      ],
                    );
                  }),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _MerHeroCard extends StatelessWidget {
  const _MerHeroCard({
    required this.mer,
    required this.tooltip,
    required this.windowDays,
  });

  final double? mer;
  final String tooltip;
  final int windowDays;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('BLENDED MER', style: theme.textTheme.labelMedium),
              MorganInfoTooltip(
                message: tooltip,
                semanticsLabel: 'About blended MER',
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(formatMerRatio(mer), style: theme.textTheme.displaySmall),
          const SizedBox(height: MorganSpace.xxs),
          Text('Trailing $windowDays days · marketing efficiency ratio', style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
