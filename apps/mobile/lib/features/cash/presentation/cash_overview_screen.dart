import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'cash_flow_chart.dart';
import 'cash_projection_section.dart';

class CashOverviewScreen extends ConsumerWidget {
  const CashOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final overviewAsync = ref.watch(cashOverviewProvider);
    final money = NumberFormat.simpleCurrency();

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: overviewAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Text('Could not load cash overview.', style: theme.textTheme.bodyMedium),
          ),
          data: (overview) {
            return ListView(
              padding: const EdgeInsets.only(bottom: MorganSpace.huge),
              children: [
                const MorganDetailScreenHeader(
                  title: 'Cash',
                  subtitle: 'Monitor liquidity separately from profit',
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!overview.bankConnected) ...[
                        _ProfitOnlySection(overview: overview, money: money),
                        const SizedBox(height: MorganSpace.lg),
                        MorganPrimaryButton(
                          label: overview.runway.cta ?? 'Connect bank',
                          onPressed: () => context.push('/settings/integrations'),
                        ),
                        const SizedBox(height: MorganSpace.xl),
                      ] else ...[
                        _CashPositionMetrics(runway: overview.runway, money: money),
                        const SizedBox(height: MorganSpace.lg),
                        MorganSurface(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('30-DAY CASH FLOW', style: theme.textTheme.labelMedium),
                              const SizedBox(height: MorganSpace.md),
                              CashFlowChart(
                                points: overview.flowBreakdown,
                                windowDays: overview.windowDays,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: MorganSpace.lg),
                        const CashProjectionSection(),
                        const SizedBox(height: MorganSpace.xl),
                      ],
                      _ExpectedPayoutsSection(payouts: overview.expectedPayouts, money: money),
                      const SizedBox(height: MorganSpace.xl),
                      _ReconciliationSummaryCard(overview: overview),
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

class _ReconciliationSummaryCard extends StatelessWidget {
  const _ReconciliationSummaryCard({required this.overview});

  final CashOverview overview;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MorganSectionHeader(
          title: 'Payout reconciliation',
          badgeCount: overview.unmatchedPayoutCount + overview.unmatchedDepositCount,
          action: () => context.push('/cash/unmatched'),
          actionLabel: overview.hasReconciliationGaps ? 'Review' : 'View',
        ),
        MorganSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${overview.matchedCount} matched · ${overview.unmatchedPayoutCount} unmatched payouts · ${overview.unmatchedDepositCount} unmatched deposits',
                style: theme.textTheme.bodyMedium,
              ),
              if (overview.hasReconciliationGaps) ...[
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Some payouts or deposits still need attention.',
                  style: theme.textTheme.bodySmall?.copyWith(color: p.warning),
                ),
              ],
              const SizedBox(height: MorganSpace.md),
              MorganPrimaryButton(
                label: overview.hasReconciliationGaps ? 'Review unmatched' : 'View reconciliation',
                onPressed: () => context.push('/cash/unmatched'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CashPositionMetrics extends StatelessWidget {
  const _CashPositionMetrics({required this.runway, required this.money});

  final CashRunway runway;
  final NumberFormat money;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final balance = double.tryParse(runway.currentBalance ?? '');
    final outflow = double.tryParse(runway.avgDailyNetOutflow ?? '');
    final statusColor = switch (runway.runwayStatus) {
      'healthy' => p.profit,
      'warning' => p.warning,
      'critical' => p.loss,
      _ => p.textMuted,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MorganSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('CASH RUNWAY', style: theme.textTheme.labelMedium),
              const SizedBox(height: MorganSpace.sm),
              Text(
                runway.displayValue,
                style: theme.textTheme.headlineMedium?.copyWith(color: statusColor),
              ),
              const SizedBox(height: MorganSpace.xs),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: MorganSpace.sm,
                  vertical: MorganSpace.xxs,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(MorganRadius.pill),
                ),
                child: Text(
                  runway.statusLabel,
                  style: theme.textTheme.labelMedium?.copyWith(color: statusColor),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: MorganSpace.sm),
        Row(
          children: [
            Expanded(
              child: MorganMetricCard(
                compact: true,
                label: 'Current balance',
                value: balance == null ? '—' : money.format(balance),
              ),
            ),
            const SizedBox(width: MorganSpace.sm),
            Expanded(
              child: MorganMetricCard(
                compact: true,
                label: 'Avg daily burn',
                value: outflow == null ? '—' : money.format(outflow),
                subtitle: '30-day net outflow',
              ),
            ),
          ],
        ),
        if (runway.message != null) ...[
          const SizedBox(height: MorganSpace.sm),
          Text(runway.message!, style: theme.textTheme.bodySmall),
        ],
      ],
    );
  }
}

class _ProfitOnlySection extends StatelessWidget {
  const _ProfitOnlySection({required this.overview, required this.money});

  final CashOverview overview;
  final NumberFormat money;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final profitOnly = overview.profitOnly;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MorganSurface(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline_rounded, color: p.warning, size: 20),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Text(
                  profitOnly?.disclaimer ??
                      'Bank not connected. Connect Plaid for cash balance, runway, and cash flow.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: MorganSpace.lg),
        Row(
          children: [
            Expanded(
              child: MorganMetricCard(
                label: '30d contribution profit',
                value: profitOnly?.contributionMargin30d == null
                    ? '—'
                    : money.format(profitOnly!.contributionMargin30d),
              ),
            ),
            const SizedBox(width: MorganSpace.sm),
            Expanded(
              child: MorganMetricCard(
                label: '30d net revenue',
                value: profitOnly?.netRevenue30d == null ? '—' : money.format(profitOnly!.netRevenue30d),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ExpectedPayoutsSection extends StatelessWidget {
  const _ExpectedPayoutsSection({required this.payouts, required this.money});

  final List<ExpectedPayout> payouts;
  final NumberFormat money;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const MorganSectionHeader(title: 'Expected Shopify payouts'),
        if (payouts.isEmpty)
          Text('No scheduled payouts found.', style: theme.textTheme.bodySmall)
        else
          ...payouts.map((payout) {
            final amount = double.tryParse(payout.amount) ?? 0;
            final day = DateTime.tryParse('${payout.day}T12:00:00Z');
            return Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.sm),
              child: MorganSurface(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            day == null ? payout.day : DateFormat.yMMMd().format(day),
                            style: theme.textTheme.titleSmall,
                          ),
                          const SizedBox(height: MorganSpace.xxs),
                          Text(
                            '${payout.payoutCount} payout${payout.payoutCount == 1 ? '' : 's'} · ${payout.currency}',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Text(money.format(amount), style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }
}
