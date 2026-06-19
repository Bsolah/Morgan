import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../widgets/campaign_trend_chart.dart';

class CampaignDetailScreen extends ConsumerWidget {
  const CampaignDetailScreen({
    super.key,
    required this.channel,
    required this.campaignId,
    this.windowDays = 7,
  });

  final String channel;
  final String campaignId;
  final int windowDays;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.simpleCurrency();
    final key = CampaignDetailKey(
      channel: channel,
      campaignId: campaignId,
      windowDays: windowDays,
    );
    final detailAsync = ref.watch(campaignDetailProvider(key));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: Text('Campaign detail', style: theme.textTheme.titleMedium),
      ),
      body: SafeArea(
        child: detailAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load campaign detail.', style: theme.textTheme.bodyMedium),
          ),
          data: (detail) {
            if (detail == null) {
              return Center(child: Text('Campaign not found.', style: theme.textTheme.bodyMedium));
            }

            final lowPoas = detail.poas != null && detail.poas! < 1;

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                Text(detail.campaignName, style: theme.textTheme.headlineSmall),
                const SizedBox(height: MorganSpace.xxs),
                Text(
                  detail.channel.replaceAll('_', ' ').toUpperCase(),
                  style: theme.textTheme.labelMedium,
                ),
                const SizedBox(height: MorganSpace.lg),
                Row(
                  children: [
                    Expanded(
                      child: MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'POAS (${detail.windowDays}d)'.toUpperCase(),
                              style: theme.textTheme.labelMedium,
                            ),
                            const SizedBox(height: MorganSpace.sm),
                            Text(
                              formatMarketingRatio(detail.poas),
                              style: theme.textTheme.headlineMedium?.copyWith(
                                color: lowPoas ? p.loss : p.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Spend (${detail.windowDays}d)',
                        value: money.format(detail.adSpend),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MorganSpace.sm),
                MorganMetricCard(
                  label: 'Attributed revenue (${detail.windowDays}d)',
                  value: money.format(detail.attributedRevenue),
                ),
                const SizedBox(height: MorganSpace.xl),
                Text('${detail.trendDays}-DAY TREND', style: theme.textTheme.labelMedium),
                const SizedBox(height: MorganSpace.sm),
                MorganSurface(
                  child: CampaignTrendChart(
                    points: detail.trend,
                    trendDays: detail.trendDays,
                  ),
                ),
                if (detail.adWaste && detail.recommendationId != null) ...[
                  const SizedBox(height: MorganSpace.xl),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('AD WASTE DETECTED', style: theme.textTheme.labelSmall?.copyWith(color: p.loss)),
                        const SizedBox(height: MorganSpace.sm),
                        Text(
                          'This campaign has spent with POAS below 1 for multiple days.',
                          style: theme.textTheme.bodyMedium,
                        ),
                        const SizedBox(height: MorganSpace.md),
                        MorganPrimaryButton(
                          label: 'View recommendation',
                          onPressed: () => context.push('/recommendations/${detail.recommendationId}'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
