import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class MarketingBudgetTab extends ConsumerWidget {
  const MarketingBudgetTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final allocationAsync = ref.watch(marketingBudgetAllocationProvider);

    return allocationAsync.when(
      loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
      error: (_, __) => Padding(
        padding: const EdgeInsets.all(MorganSpace.screenH),
        child: Text(
          'Could not load budget reallocation suggestions.',
          style: theme.textTheme.bodyMedium,
        ),
      ),
      data: (allocation) {
        if (allocation == null) {
          return Padding(
            padding: const EdgeInsets.all(MorganSpace.screenH),
            child: Text('Connect ad channels to see budget shift suggestions.', style: theme.textTheme.bodyMedium),
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
            const MorganScreenHeader(
              title: 'Budget reallocation',
              subtitle: 'Shift spend toward higher marginal POAS campaigns (30d)',
            ),
            MorganSurface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total ad budget (30d): ${formatMarketingCurrency(allocation.totalBudgetUsd.toDouble())}',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: MorganSpace.xs),
                  Text(
                    'Suggestions only — apply changes manually in Meta or Google Ads.',
                    style: theme.textTheme.labelSmall?.copyWith(color: p.textSecondary),
                  ),
                ],
              ),
            ),
            if (allocation.scenarios.isEmpty) ...[
              const SizedBox(height: MorganSpace.lg),
              MorganSurface(
                child: Text(
                  'No profitable shifts found above \$200/mo at \$500 increments. Check back when you have at least two active campaigns.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ] else ...[
              const SizedBox(height: MorganSpace.lg),
              Text('Top ${allocation.scenarios.length} shifts', style: theme.textTheme.titleMedium),
              const SizedBox(height: MorganSpace.md),
              ...allocation.scenarios.map((scenario) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: MorganSpace.md),
                  child: MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Shift ${formatMarketingCurrency(scenario.amount.toDouble())}',
                          style: theme.textTheme.titleSmall,
                        ),
                        const SizedBox(height: MorganSpace.xs),
                        Text(
                          'From ${scenario.fromCampaign}',
                          style: theme.textTheme.bodySmall,
                        ),
                        Text(
                          'To ${scenario.toCampaign}',
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        Text(
                          'Projected +${formatMarketingCurrency(scenario.projectedProfitDelta.toDouble())}/mo profit',
                          style: theme.textTheme.titleMedium?.copyWith(color: p.profit),
                        ),
                        const SizedBox(height: MorganSpace.xs),
                        Text(
                          'Marginal POAS ${scenario.sourceMarginalPoas.toStringAsFixed(2)} → ${scenario.targetMarginalPoas.toStringAsFixed(2)}',
                          style: theme.textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
            if (allocation.marginalPoasCurves.isNotEmpty) ...[
              const SizedBox(height: MorganSpace.lg),
              Text('Marginal POAS by campaign', style: theme.textTheme.titleMedium),
              const SizedBox(height: MorganSpace.md),
              ...allocation.marginalPoasCurves.take(5).map((curve) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                  child: MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(curve.campaignName, style: theme.textTheme.titleSmall),
                        const SizedBox(height: MorganSpace.xxs),
                        Text(
                          'Marginal POAS ${curve.marginalPoas30d.toStringAsFixed(2)} · ${curve.curvePoints.length} buckets',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        );
      },
    );
  }
}
