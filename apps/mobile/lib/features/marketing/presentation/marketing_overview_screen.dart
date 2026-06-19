import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'marketing_mer_tab.dart';

class MarketingOverviewScreen extends ConsumerStatefulWidget {
  const MarketingOverviewScreen({super.key});

  @override
  ConsumerState<MarketingOverviewScreen> createState() => _MarketingOverviewScreenState();
}

class _MarketingOverviewScreenState extends ConsumerState<MarketingOverviewScreen>
    with SingleTickerProviderStateMixin {
  int _windowDays = 7;
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _setWindowDays(int days) {
    if (_windowDays == days) return;
    setState(() => _windowDays = days);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final overviewAsync = ref.watch(marketingOverviewProvider(_windowDays));
    final metaAsync = ref.watch(metaIntegrationStatusProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: MorganScreenHeader(
                title: 'Marketing',
                subtitle: 'Campaign POAS and channel efficiency',
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(text: 'Campaigns'),
                  Tab(text: 'Channels'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  overviewAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (_, __) => Padding(
                      padding: const EdgeInsets.all(MorganSpace.screenH),
                      child: Text('Could not load marketing data.', style: theme.textTheme.bodySmall),
                    ),
                    data: (overview) => _CampaignsTab(
                      overview: overview,
                      metaAsync: metaAsync,
                      windowDays: _windowDays,
                      onWindowDaysChanged: _setWindowDays,
                    ),
                  ),
                  const SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      MorganSpace.screenH,
                      MorganSpace.md,
                      MorganSpace.screenH,
                      MorganSpace.huge,
                    ),
                    child: MarketingMerTab(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CampaignsTab extends StatelessWidget {
  const _CampaignsTab({
    required this.overview,
    required this.metaAsync,
    required this.windowDays,
    required this.onWindowDaysChanged,
  });

  final MarketingOverview overview;
  final AsyncValue<MetaIntegrationStatus> metaAsync;
  final int windowDays;
  final ValueChanged<int> onWindowDaysChanged;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.compactCurrency(symbol: '\$');

    if (!overview.adsConnected) {
      return ListView(
        padding: const EdgeInsets.all(MorganSpace.screenH),
        children: [
          Text(
            'Connect Meta Ads or Google Ads to unlock POAS and campaign profitability.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: MorganSpace.md),
          MorganPrimaryButton(
            label: 'Connect ad accounts',
            onPressed: () => context.push('/settings/integrations'),
          ),
        ],
      );
    }

    if (overview.summaryAdSpend <= 0) {
      return ListView(
        padding: const EdgeInsets.all(MorganSpace.screenH),
        children: [
          Text(
            metaAsync.maybeWhen(
              data: (meta) => meta.status == IntegrationStatus.syncing
                  ? 'Ad accounts are syncing campaign data. POAS will appear after the first insights import.'
                  : 'No ad spend found for the trailing $windowDays days.',
              orElse: () => 'No ad spend found for the trailing $windowDays days.',
            ),
            style: theme.textTheme.bodyMedium,
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        MorganSpace.screenH,
        MorganSpace.md,
        MorganSpace.screenH,
        MorganSpace.huge,
      ),
      children: [
        Row(
          children: [
            Expanded(
              child: _MetricWithTooltip(
                label: 'POAS',
                value: formatMarketingRatio(overview.summaryPoas),
                tooltip: overview.poasTooltip,
                highlightLow: overview.summaryPoas != null && overview.summaryPoas! < 1,
              ),
            ),
            const SizedBox(width: MorganSpace.sm),
            Expanded(
              child: _MetricWithTooltip(
                label: 'ROAS',
                value: formatMarketingRatio(overview.summaryRoas),
                tooltip: overview.roasTooltip,
              ),
            ),
          ],
        ),
        const SizedBox(height: MorganSpace.sm),
        MorganMetricCard(
          label: 'Ad spend',
          value: NumberFormat.simpleCurrency().format(overview.summaryAdSpend),
          subtitle: 'Trailing $windowDays days',
        ),
        const SizedBox(height: MorganSpace.lg),
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(value: 7, label: Text('7d')),
            ButtonSegment(value: 30, label: Text('30d')),
          ],
          selected: {windowDays},
          onSelectionChanged: (selection) => onWindowDaysChanged(selection.first),
        ),
        const SizedBox(height: MorganSpace.lg),
        Text('CAMPAIGNS BY POAS', style: theme.textTheme.labelMedium),
        const SizedBox(height: MorganSpace.sm),
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
                    Expanded(flex: 3, child: Text('Campaign', style: theme.textTheme.labelSmall)),
                    Expanded(
                      child: Text('Spend', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                    ),
                    Expanded(
                      child: Text('Rev', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                    ),
                    Expanded(
                      child: Text('POAS', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                    ),
                    Expanded(
                      child: Text('ROAS', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: p.borderSubtle),
              ...overview.campaigns.map((campaign) {
                final lowPoas = campaign.isLowPoas;
                return Column(
                  children: [
                    InkWell(
                      onTap: () => context.push(
                        '/marketing/campaigns/${Uri.encodeComponent(campaign.channel)}/${Uri.encodeComponent(campaign.campaignId)}?windowDays=$windowDays',
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: MorganSpace.card,
                          vertical: MorganSpace.sm,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 3,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    campaign.campaignName,
                                    style: theme.textTheme.titleSmall,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (campaign.adWaste)
                                    Padding(
                                      padding: const EdgeInsets.only(top: MorganSpace.xxs),
                                      child: Text(
                                        'Ad waste',
                                        style: theme.textTheme.labelSmall?.copyWith(color: p.loss),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Text(
                                money.format(campaign.adSpend),
                                style: theme.textTheme.bodySmall,
                                textAlign: TextAlign.end,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                money.format(campaign.attributedRevenue),
                                style: theme.textTheme.bodySmall,
                                textAlign: TextAlign.end,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                formatMarketingRatio(campaign.poas),
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: lowPoas ? p.loss : p.textPrimary,
                                ),
                                textAlign: TextAlign.end,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                formatMarketingRatio(campaign.roas),
                                style: theme.textTheme.bodySmall,
                                textAlign: TextAlign.end,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (campaign != overview.campaigns.last)
                      Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                  ],
                );
              }),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetricWithTooltip extends StatelessWidget {
  const _MetricWithTooltip({
    required this.label,
    required this.value,
    required this.tooltip,
    this.highlightLow = false,
  });

  final String label;
  final String value;
  final String tooltip;
  final bool highlightLow;

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
              Text(label.toUpperCase(), style: theme.textTheme.labelMedium),
              const SizedBox(width: MorganSpace.xxs),
              Tooltip(
                message: tooltip,
                triggerMode: TooltipTriggerMode.tap,
                child: Icon(Icons.info_outline, size: 16, color: p.textMuted),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(
            value,
            style: theme.textTheme.headlineMedium?.copyWith(
              color: highlightLow ? p.loss : p.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
