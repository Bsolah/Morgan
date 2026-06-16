import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';

class KpiTile extends StatelessWidget {
  const KpiTile({
    super.key,
    required this.label,
    required this.value,
    required this.delta,
    this.fullWidth = false,
    this.accent = KpiAccent.primary,
  });

  final String label;
  final String value;
  final String? delta;
  final bool fullWidth;
  final KpiAccent accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accentColor = switch (accent) {
      KpiAccent.primary => MorganColors.primary,
      KpiAccent.secondary => MorganColors.secondary,
      KpiAccent.tertiary => MorganColors.tertiary,
    };
    final accentSurface = switch (accent) {
      KpiAccent.primary => MorganColors.primaryContainer,
      KpiAccent.secondary => MorganColors.secondaryContainer,
      KpiAccent.tertiary => MorganColors.tertiaryContainer,
    };

    Color? deltaColor;
    Color? deltaBg;
    if (delta != null) {
      if (delta!.startsWith('+')) {
        deltaColor = MorganColors.profit;
        deltaBg = MorganColors.profitSurface;
      } else {
        deltaColor = MorganColors.loss;
        deltaBg = MorganColors.lossSurface;
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: accentColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Text(label.toUpperCase(), style: theme.textTheme.labelLarge),
              ],
            ),
            const SizedBox(height: 12),
            Text(value, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: MorganColors.textPrimary)),
            if (delta != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: deltaBg, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  delta!,
                  style: TextStyle(color: deltaColor, fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
            ] else if (value == 'Connect bank') ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: accentSurface, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  'Tap to unlock',
                  style: TextStyle(color: accentColor, fontWeight: FontWeight.w600, fontSize: 12),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum KpiAccent { primary, secondary, tertiary }
