import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class ProfitDaySummarySheet {
  static Future<void> show(BuildContext context, String day) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ProfitDaySummarySheet(day: day),
    );
  }
}

class _ProfitDaySummarySheet extends ConsumerWidget {
  const _ProfitDaySummarySheet({required this.day});

  final String day;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final summaryAsync = ref.watch(profitDaySummaryProvider(day));
    final parsedDay = DateTime.tryParse('${day}T12:00:00Z');

    return Container(
      margin: const EdgeInsets.all(MorganSpace.md),
      padding: const EdgeInsets.fromLTRB(
        MorganSpace.lg,
        MorganSpace.lg,
        MorganSpace.lg,
        MorganSpace.huge,
      ),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(MorganRadius.lg),
        border: Border.all(color: p.borderSubtle),
      ),
      child: summaryAsync.when(
        loading: () => SizedBox(
          height: 160,
          child: Center(child: CircularProgressIndicator(color: p.accent)),
        ),
        error: (_, __) => Text('Could not load orders for this day.', style: theme.textTheme.bodyMedium),
        data: (summary) {
          if (summary == null) {
            return Text('No order data for this day.', style: theme.textTheme.bodyMedium);
          }

          final money = NumberFormat.simpleCurrency();

          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                parsedDay == null ? day : DateFormat('EEEE, MMM d').format(parsedDay.toUtc()),
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: MorganSpace.xs),
              Text('Daily orders summary', style: theme.textTheme.bodySmall),
              const SizedBox(height: MorganSpace.lg),
              _SummaryRow(label: 'Orders', value: '${summary.orders}'),
              _SummaryRow(label: 'Units sold', value: '${summary.unitsSold}'),
              _SummaryRow(label: 'Net revenue', value: money.format(summary.netRevenue)),
              _SummaryRow(label: 'COGS', value: money.format(summary.cogs)),
              _SummaryRow(
                label: 'Contribution margin',
                value: money.format(summary.contributionMargin),
                highlight: true,
              ),
              _SummaryRow(label: 'Margin', value: formatMarginPct(summary.marginPct)),
            ],
          );
        },
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: Row(
        children: [
          Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
          Text(
            value,
            style: highlight
                ? theme.textTheme.titleSmall?.copyWith(color: p.profit, fontWeight: FontWeight.w600)
                : theme.textTheme.titleSmall,
          ),
        ],
      ),
    );
  }
}
