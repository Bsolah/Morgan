import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class PricingSuggestionsSection extends ConsumerWidget {
  const PricingSuggestionsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final suggestionsAsync = ref.watch(pricingSuggestionsProvider);

    return suggestionsAsync.when(
      loading: () => const MorganProfitSectionSkeleton(),
      error: (_, __) => const SizedBox.shrink(),
      data: (response) {
        if (response == null || response.isEmpty) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const MorganSectionHeader(title: 'Pricing suggestions'),
              Text(
                'Margin-backed recommendations from your catalog and return data',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: MorganSpace.sm),
              MorganSurface(
                child: Text(
                  'Recommendations only — update prices manually in Shopify.',
                  style: theme.textTheme.labelSmall?.copyWith(color: p.textSecondary),
                ),
              ),
              if (response.increaseSuggestions.isNotEmpty) ...[
                const SizedBox(height: MorganSpace.lg),
                Text('Price increases', style: theme.textTheme.titleMedium),
                Text(
                  'Target ${(response.targetMarginRate * 100).round()}% margin · up to 5% per step',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: MorganSpace.md),
                ...response.increaseSuggestions.take(5).map(
                      (suggestion) => _IncreaseSuggestionCard(suggestion: suggestion),
                    ),
              ],
              if (response.decreaseSuggestions.isNotEmpty) ...[
                const SizedBox(height: MorganSpace.lg),
                Text('High-return SKUs', style: theme.textTheme.titleMedium),
                Text(
                  'Returns above category mean + 2σ while priced above median',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: MorganSpace.md),
                ...response.decreaseSuggestions.take(5).map(
                      (suggestion) => _DecreaseSuggestionCard(suggestion: suggestion),
                    ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _IncreaseSuggestionCard extends StatelessWidget {
  const _IncreaseSuggestionCard({required this.suggestion});

  final PriceIncreaseSuggestionItem suggestion;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: MorganSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    suggestion.title ?? suggestion.sku,
                    style: theme.textTheme.titleSmall,
                  ),
                ),
                if (suggestion.confidence == 'low')
                  _LowConfidenceBadge(color: p.warning),
              ],
            ),
            const SizedBox(height: MorganSpace.xxs),
            Text(suggestion.sku, style: theme.textTheme.bodySmall),
            const SizedBox(height: MorganSpace.sm),
            Text(
              '\$${suggestion.currentPrice.toStringAsFixed(2)} → \$${suggestion.suggestedPrice.toStringAsFixed(2)} (+${suggestion.increasePct.toStringAsFixed(1)}%)',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: MorganSpace.xs),
            Text(
              'Expected margin +${formatProfitCurrency(suggestion.expectedMarginDeltaUsd)}/mo · ${suggestion.expectedUnitDelta.toStringAsFixed(1)} units/mo',
              style: theme.textTheme.bodySmall?.copyWith(color: p.profit),
            ),
          ],
        ),
      ),
    );
  }
}

class _DecreaseSuggestionCard extends StatelessWidget {
  const _DecreaseSuggestionCard({required this.suggestion});

  final PriceDecreaseSuggestionItem suggestion;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final evidence = suggestion.evidence;

    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: MorganSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(suggestion.title ?? suggestion.sku, style: theme.textTheme.titleSmall),
            const SizedBox(height: MorganSpace.xxs),
            Text('${suggestion.sku} · ${suggestion.category}', style: theme.textTheme.bodySmall),
            const SizedBox(height: MorganSpace.sm),
            if (suggestion.isBundle)
              Text('Bundle with a top seller instead of cutting price', style: theme.textTheme.titleMedium)
            else
              Text(
                '\$${suggestion.currentPrice.toStringAsFixed(2)} → \$${suggestion.suggestedPrice?.toStringAsFixed(2)} (-${suggestion.decreasePct?.toStringAsFixed(1)}%)',
                style: theme.textTheme.titleMedium,
              ),
            const SizedBox(height: MorganSpace.xs),
            Text(
              'Return rate ${evidence.returnRatePct.toStringAsFixed(1)}% vs category ${evidence.categoryMeanReturnRatePct.toStringAsFixed(1)}% (threshold ${evidence.returnRateThresholdPct.toStringAsFixed(1)}%)',
              style: theme.textTheme.bodySmall?.copyWith(color: p.loss),
            ),
            const SizedBox(height: MorganSpace.xxs),
            Text(
              'Category median \$${evidence.categoryMedianPrice.toStringAsFixed(2)}',
              style: theme.textTheme.labelSmall,
            ),
            if (evidence.competitorPriceLow != null && evidence.competitorPriceHigh != null) ...[
              const SizedBox(height: MorganSpace.xxs),
              Text(
                evidence.competitorPriceSource == 'category_peers'
                    ? 'Peer price range \$${evidence.competitorPriceLow!.toStringAsFixed(2)}–\$${evidence.competitorPriceHigh!.toStringAsFixed(2)}'
                    : 'Competitor range \$${evidence.competitorPriceLow!.toStringAsFixed(2)}–\$${evidence.competitorPriceHigh!.toStringAsFixed(2)}',
                style: theme.textTheme.labelSmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LowConfidenceBadge extends StatelessWidget {
  const _LowConfidenceBadge({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: MorganSpace.xs,
        vertical: MorganSpace.xxs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(MorganRadius.xs),
      ),
      child: Text(
        'Low confidence',
        style: theme.textTheme.labelSmall?.copyWith(color: color),
      ),
    );
  }
}
