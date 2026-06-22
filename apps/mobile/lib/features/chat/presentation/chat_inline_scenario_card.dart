import 'package:flutter/material.dart';

import '../../../core/chat/chat_models.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ChatInlineScenarioCard extends StatelessWidget {
  const ChatInlineScenarioCard({
    super.key,
    required this.scenarioCard,
    required this.onSave,
    this.busy = false,
  });

  final ChatScenarioCard scenarioCard;
  final VoidCallback onSave;
  final bool busy;

  String _formatCurrency(int value) {
    final sign = value >= 0 ? '+' : '-';
    return '$sign\$${value.abs()}';
  }

  String _formatRange(int low, int high) {
    if (low == high) return _formatCurrency(low);
    final orderedLow = low < high ? low : high;
    final orderedHigh = low < high ? high : low;
    return '${_formatCurrency(orderedLow)} to ${_formatCurrency(orderedHigh)}';
  }

  String? _formatRunwayRange(double? low, double? high) {
    if (low == null || high == null) return null;
    final orderedLow = low < high ? low : high;
    final orderedHigh = low < high ? high : low;
    if ((orderedLow - orderedHigh).abs() < 0.05) {
      return '${orderedLow.toStringAsFixed(1)} days';
    }
    return '${orderedLow.toStringAsFixed(1)} to ${orderedHigh.toStringAsFixed(1)} days';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final forecast = scenarioCard.forecast;
    final runwayText = _formatRunwayRange(forecast.runwayDaysDeltaLow, forecast.runwayDaysDeltaHigh);

    return MorganSurface(
      color: p.surfaceMuted,
      borderColor: p.accent.withValues(alpha: 0.25),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.insights_rounded, size: 18, color: p.accent),
              const SizedBox(width: MorganSpace.xs),
              Text('Scenario forecast', style: theme.textTheme.labelMedium?.copyWith(color: p.accent)),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(scenarioCard.title, style: theme.textTheme.titleMedium),
          const SizedBox(height: MorganSpace.md),
          _MetricRow(
            label: 'Projected revenue change (7d)',
            value: _formatRange(forecast.revenueChangeLowUsd, forecast.revenueChangeHighUsd),
          ),
          const SizedBox(height: MorganSpace.sm),
          _MetricRow(
            label: 'Projected profit change (7d)',
            value: _formatRange(forecast.profitChangeLowUsd, forecast.profitChangeHighUsd),
            valueColor: p.profit,
          ),
          const SizedBox(height: MorganSpace.sm),
          _MetricRow(
            label: 'Cash impact (7d)',
            value: _formatRange(forecast.cashImpactLowUsd, forecast.cashImpactHighUsd),
          ),
          if (runwayText != null) ...[
            const SizedBox(height: MorganSpace.sm),
            _MetricRow(label: 'Runway change', value: runwayText),
          ],
          const SizedBox(height: MorganSpace.sm),
          _MetricRow(
            label: 'Confidence',
            value: '${forecast.confidence[0].toUpperCase()}${forecast.confidence.substring(1)} (±${forecast.confidenceBandPct}%)',
          ),
          const SizedBox(height: MorganSpace.md),
          Text('ASSUMPTIONS', style: theme.textTheme.labelSmall),
          const SizedBox(height: MorganSpace.xs),
          ...forecast.assumptions.map(
            (assumption) => Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.xxs),
              child: Text('• $assumption', style: theme.textTheme.bodySmall),
            ),
          ),
          const SizedBox(height: MorganSpace.md),
          if (scenarioCard.saved)
            Text(
              'Saved to Scenario Planner',
              style: theme.textTheme.labelMedium?.copyWith(color: p.profit),
            )
          else
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: busy ? null : onSave,
                child: busy
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: p.accent),
                      )
                    : const Text('Save to Scenario Planner'),
              ),
            ),
        ],
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: theme.textTheme.bodySmall)),
        const SizedBox(width: MorganSpace.sm),
        Text(
          value,
          style: theme.textTheme.titleSmall?.copyWith(
            color: valueColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
