import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_secondary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../widgets/campaign_trend_chart.dart';
import '../widgets/marketing_campaign_row.dart';

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
      body: SafeArea(
        child: detailAsync.when(
          loading: () => Column(
            children: [
              const MorganDetailAppBar(title: 'Campaign', fallbackRoute: '/marketing'),
              Expanded(child: Center(child: CircularProgressIndicator(color: p.accent))),
            ],
          ),
          error: (_, __) => Column(
            children: [
              const MorganDetailAppBar(title: 'Campaign', fallbackRoute: '/marketing'),
              Expanded(
                child: Center(
                  child: Text('Could not load campaign detail.', style: theme.textTheme.bodyMedium),
                ),
              ),
            ],
          ),
          data: (detail) {
            if (detail == null) {
              return Column(
                children: [
                  const MorganDetailAppBar(title: 'Campaign', fallbackRoute: '/marketing'),
                  Expanded(
                    child: Center(child: Text('Campaign not found.', style: theme.textTheme.bodyMedium)),
                  ),
                ],
              );
            }

            final lowPoas = detail.poas != null && detail.poas! < 1;
            final hasAction = detail.adWaste || detail.recommendationId != null;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MorganDetailAppBar(
                  title: detail.campaignName,
                  fallbackRoute: '/marketing',
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                      MorganSpace.screenH,
                      MorganSpace.sm,
                      MorganSpace.screenH,
                      MorganSpace.huge,
                    ),
                    children: [
                      _ChannelPill(label: marketingChannelLabel(detail.channel)),
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
                            child: MorganSurface(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'SPEND (${detail.windowDays}d)'.toUpperCase(),
                                    style: theme.textTheme.labelMedium,
                                  ),
                                  const SizedBox(height: MorganSpace.sm),
                                  Text(
                                    money.format(detail.adSpend),
                                    style: theme.textTheme.headlineMedium,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (hasAction) ...[
                        const SizedBox(height: MorganSpace.lg),
                        _CampaignActionStrip(detail: detail),
                      ],
                      const SizedBox(height: MorganSpace.xl),
                      Text('${detail.trendDays}-DAY TREND', style: theme.textTheme.labelMedium),
                      const SizedBox(height: MorganSpace.sm),
                      MorganSurface(
                        child: CampaignTrendChart(
                          points: detail.trend,
                          trendDays: detail.trendDays,
                        ),
                      ),
                      const SizedBox(height: MorganSpace.lg),
                      MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Attributed revenue (${detail.windowDays}d)', style: theme.textTheme.labelMedium),
                            const SizedBox(height: MorganSpace.xxs),
                            Text(
                              money.format(detail.attributedRevenue),
                              style: theme.textTheme.titleMedium,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ChannelPill extends StatelessWidget {
  const _ChannelPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.xxs),
      decoration: BoxDecoration(
        color: p.accentMuted,
        borderRadius: BorderRadius.circular(MorganRadius.pill),
        border: Border.all(color: p.accent.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(color: p.accent, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _CampaignActionStrip extends StatelessWidget {
  const _CampaignActionStrip({required this.detail});

  final CampaignDetail detail;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (detail.adWaste) ...[
            Text('AD WASTE DETECTED', style: theme.textTheme.labelSmall?.copyWith(color: p.loss)),
            const SizedBox(height: MorganSpace.xs),
            Text(
              'This campaign has spent with POAS below 1 for multiple days. Consider pausing or reducing budget.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: MorganSpace.md),
          ],
          if (detail.recommendationId != null)
            MorganPrimaryButton(
              label: detail.adWaste ? 'View pause recommendation' : 'View recommendation',
              onPressed: () => context.push('/recommendations/${detail.recommendationId}'),
            )
          else if (detail.adWaste)
            MorganSecondaryButton(
              label: 'Ask Morgan about this campaign',
              onPressed: () => context.push(
                '/chat?prompt=${Uri.encodeComponent('Should I pause ${detail.campaignName}?')}',
              ),
            ),
        ],
      ),
    );
  }
}
