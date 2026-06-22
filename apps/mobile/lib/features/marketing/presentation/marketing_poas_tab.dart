import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../../../shared/widgets/morgan_info_tooltip.dart';
import '../widgets/campaign_trend_chart.dart';
import '../widgets/marketing_campaign_row.dart';
import '../widgets/marketing_meta_connect_card.dart';

/// POAS tab: hero · 7d trend · campaign list (US-UX-11-01).
class MarketingPoasTab extends ConsumerWidget {
  const MarketingPoasTab({super.key});

  static const _windowDays = 7;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final overviewAsync = ref.watch(marketingOverviewProvider(_windowDays));
    final metaAsync = ref.watch(metaIntegrationStatusProvider);

    return overviewAsync.when(
      loading: () => const ListView(
        padding: EdgeInsets.all(MorganSpace.screenH),
        children: [MorganProfitSectionSkeleton(cardCount: 2)],
      ),
      error: (_, __) => ListView(
        padding: const EdgeInsets.all(MorganSpace.screenH),
        children: [
          Text('Could not load marketing data.', style: theme.textTheme.bodyMedium),
        ],
      ),
      data: (overview) {
        if (!overview.adsConnected) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              MorganSpace.screenH,
              MorganSpace.md,
              MorganSpace.screenH,
              MorganSpace.huge,
            ),
            children: [
              const MarketingMetaConnectCard(),
              SizedBox(height: MorganSpace.md),
              Text(
                'Connect Meta Ads or Google Ads to unlock POAS and campaign profitability.',
                style: theme.textTheme.bodyMedium,
              ),
            ],
          );
        }

        if (overview.summaryAdSpend <= 0) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              MorganSpace.screenH,
              MorganSpace.md,
              MorganSpace.screenH,
              MorganSpace.huge,
            ),
            children: [
              if (!overview.metaConnected) ...[
                const MarketingMetaConnectCard(),
                const SizedBox(height: MorganSpace.lg),
              ],
              Text(
                metaAsync.maybeWhen(
                  data: (meta) => meta.status == IntegrationStatus.syncing
                      ? 'Ad accounts are syncing campaign data. POAS will appear after the first insights import.'
                      : 'No ad spend found for the trailing $_windowDays days.',
                  orElse: () => 'No ad spend found for the trailing $_windowDays days.',
                ),
                style: theme.textTheme.bodyMedium,
              ),
            ],
          );
        }

        final lowPoas = overview.summaryPoas != null && overview.summaryPoas! < 1;

        return ListView(
          padding: const EdgeInsets.fromLTRB(
            MorganSpace.screenH,
            MorganSpace.md,
            MorganSpace.screenH,
            MorganSpace.huge,
          ),
          children: [
            if (!overview.metaConnected) ...[
              const MarketingMetaConnectCard(),
              const SizedBox(height: MorganSpace.lg),
            ],
            _PoasHeroCard(
              poas: overview.summaryPoas,
              tooltip: overview.poasTooltip,
              highlightLow: lowPoas,
              windowDays: overview.windowDays,
            ),
            const SizedBox(height: MorganSpace.lg),
            const MorganSectionHeader(title: '7-day POAS trend'),
            MorganSurface(
              child: CampaignTrendChart(
                points: overview.trend,
                trendDays: overview.trendDays,
              ),
            ),
            const SizedBox(height: MorganSpace.xl),
            const MorganSectionHeader(title: 'Campaigns'),
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
                          child: Text('POAS', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                        ),
                        const SizedBox(width: 18),
                      ],
                    ),
                  ),
                  Divider(height: 1, color: p.borderSubtle),
                  ...overview.campaigns.map((campaign) {
                    final isLast = campaign == overview.campaigns.last;
                    return Column(
                      children: [
                        MarketingCampaignRow(
                          name: campaign.campaignName,
                          spend: campaign.adSpend,
                          metricLabel: 'POAS',
                          metricValue: formatMarketingRatio(campaign.poas),
                          metricColor: campaign.isLowPoas ? p.loss : null,
                          subtitle: campaign.adWaste ? 'Ad waste' : null,
                          onTap: () => context.push(
                            '/marketing/campaigns/${Uri.encodeComponent(campaign.channel)}/${Uri.encodeComponent(campaign.campaignId)}?windowDays=$_windowDays',
                          ),
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

class _PoasHeroCard extends StatelessWidget {
  const _PoasHeroCard({
    required this.poas,
    required this.tooltip,
    required this.highlightLow,
    required this.windowDays,
  });

  final double? poas;
  final String tooltip;
  final bool highlightLow;
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
              Text('BLENDED POAS', style: theme.textTheme.labelMedium),
              MorganInfoTooltip(
                message: tooltip,
                semanticsLabel: 'About blended POAS',
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(
            formatMarketingRatio(poas),
            style: theme.textTheme.displaySmall?.copyWith(
              color: highlightLow ? p.loss : p.textPrimary,
            ),
          ),
          const SizedBox(height: MorganSpace.xxs),
          Text('Trailing $windowDays days · profit on ad spend', style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
