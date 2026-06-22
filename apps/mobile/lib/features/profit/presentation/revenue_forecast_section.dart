import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class RevenueForecastSection extends ConsumerWidget {
  const RevenueForecastSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final forecastAsync = ref.watch(revenueForecastProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const MorganSectionHeader(title: '30-day revenue outlook'),
          forecastAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.only(top: MorganSpace.md),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => Padding(
              padding: const EdgeInsets.only(top: MorganSpace.sm),
              child: Text('Could not load revenue forecast.', style: theme.textTheme.bodyMedium),
            ),
            data: (forecast) {
              if (forecast == null) {
                return const SizedBox.shrink();
              }

              if (forecast.isInsufficientData) {
                return MorganSurface(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.insights_rounded, color: p.textMuted, size: 20),
                      const SizedBox(width: MorganSpace.sm),
                      Expanded(
                        child: Text(
                          forecast.message ?? 'Insufficient data',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                );
              }

              final lastCumulative = forecast.cumulative.isNotEmpty ? forecast.cumulative.last : null;
              final p50Total = lastCumulative?.p50 ?? 0;
              final bandLabel = forecast.displayBands && lastCumulative?.p10 != null && lastCumulative?.p90 != null
                  ? '${formatProfitCurrency(lastCumulative!.p10!)} – ${formatProfitCurrency(lastCumulative.p90!)}'
                  : 'Confidence bands hidden (forecast accuracy below threshold)';

              return MorganSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Projected net revenue (P50)', style: theme.textTheme.labelMedium),
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      formatProfitCurrency(p50Total),
                      style: theme.textTheme.headlineSmall?.copyWith(color: p.profit),
                    ),
                    const SizedBox(height: MorganSpace.sm),
                    Text(
                      forecast.displayBands ? 'P10–P90 cumulative band: $bandLabel' : bandLabel,
                      style: theme.textTheme.bodySmall,
                    ),
                    if (forecast.mape != null) ...[
                      const SizedBox(height: MorganSpace.xs),
                      Text(
                        'Model error (MAPE): ${(forecast.mape! * 100).toStringAsFixed(1)}%',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                    if (forecast.asOfDay != null) ...[
                      const SizedBox(height: MorganSpace.xs),
                      Text(
                        'As of ${forecast.asOfDay} · ${forecast.horizonDays}-day horizon',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
