import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'cash_projection_chart.dart';

class CashProjectionSection extends ConsumerWidget {
  const CashProjectionSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final projectionAsync = ref.watch(cashProjectionProvider);
    final money = NumberFormat.simpleCurrency();

    return projectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Text('Could not load cash projection.', style: theme.textTheme.bodyMedium),
      data: (projection) {
        if (!projection.bankConnected) {
          return const SizedBox.shrink();
        }

        if (!projection.available) {
          return MorganSurface(
            child: Text(
              projection.message ?? 'Cash projection is not available yet.',
              style: theme.textTheme.bodyMedium,
            ),
          );
        }

        final assumptions = projection.assumptions;
        final zeroDay = projection.zeroCrossingDay;

        return MorganSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('60-DAY CASH PROJECTION', style: theme.textTheme.labelMedium),
                  ),
                  TextButton(
                    onPressed: assumptions == null
                        ? null
                        : () => _openAssumptionsEditor(context, ref, projection),
                    child: const Text('Edit assumptions'),
                  ),
                ],
              ),
              const SizedBox(height: MorganSpace.sm),
              if (projection.startingBalance != null) ...[
                Text('Starting balance', style: theme.textTheme.bodySmall),
                Text(
                  money.format(double.tryParse(projection.startingBalance!) ?? 0),
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: MorganSpace.md),
              ],
              CashProjectionChart(
                points: projection.points,
                zeroCrossingDay: zeroDay,
              ),
              const SizedBox(height: MorganSpace.md),
              if (zeroDay != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(MorganSpace.sm),
                  decoration: BoxDecoration(
                    color: p.loss.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(MorganRadius.sm),
                  ),
                  child: Text(
                    'Balance may reach \$0 on ${DateFormat('MMM d, y').format(DateTime.parse('${zeroDay}T12:00:00Z'))}.',
                    style: theme.textTheme.bodyMedium?.copyWith(color: p.loss),
                  ),
                )
              else
                Text(
                  'Balance stays above \$0 over the next ${projection.horizonDays} days at current assumptions.',
                  style: theme.textTheme.bodySmall,
                ),
              if (assumptions != null) ...[
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Daily ad spend assumption: ${money.format(assumptions.expectedDailyAdSpendUsd > 0 ? assumptions.expectedDailyAdSpendUsd : assumptions.defaultsFromHistory.avgDailyAdSpendUsd)}',
                  style: theme.textTheme.bodySmall,
                ),
                if (assumptions.plannedInventoryPurchaseUsd > 0 && assumptions.plannedInventoryPurchaseDay != null)
                  Text(
                    'Planned inventory purchase: ${money.format(assumptions.plannedInventoryPurchaseUsd)} on ${assumptions.plannedInventoryPurchaseDay}',
                    style: theme.textTheme.bodySmall,
                  ),
              ],
            ],
          ),
        );
      },
    );
  }

  Future<void> _openAssumptionsEditor(
    BuildContext context,
    WidgetRef ref,
    CashProjection projection,
  ) async {
    final assumptions = projection.assumptions;
    if (assumptions == null) return;

    final adSpendController = TextEditingController(
      text: assumptions.expectedDailyAdSpendUsd > 0
          ? assumptions.expectedDailyAdSpendUsd.toStringAsFixed(2)
          : assumptions.defaultsFromHistory.avgDailyAdSpendUsd.toStringAsFixed(2),
    );
    final inventoryController = TextEditingController(
      text: assumptions.plannedInventoryPurchaseUsd.toStringAsFixed(2),
    );
    final inventoryDayController = TextEditingController(
      text: assumptions.plannedInventoryPurchaseDay ?? '',
    );

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: MorganSpace.screenH,
            right: MorganSpace.screenH,
            top: MorganSpace.lg,
            bottom: MediaQuery.viewInsetsOf(context).bottom + MorganSpace.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Forecast assumptions', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: MorganSpace.md),
              TextField(
                controller: adSpendController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Expected daily ad spend (USD)',
                ),
              ),
              const SizedBox(height: MorganSpace.sm),
              TextField(
                controller: inventoryController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Planned inventory purchase (USD)',
                ),
              ),
              const SizedBox(height: MorganSpace.sm),
              TextField(
                controller: inventoryDayController,
                decoration: const InputDecoration(
                  labelText: 'Purchase date (YYYY-MM-DD)',
                ),
              ),
              const SizedBox(height: MorganSpace.lg),
              MorganPrimaryButton(
                label: 'Save assumptions',
                onPressed: () => Navigator.of(context).pop(true),
              ),
            ],
          ),
        );
      },
    );

    if (saved != true || !context.mounted) return;

    await ref.read(cashRepositoryProvider).updateProjectionAssumptions(
          expectedDailyAdSpendUsd: double.tryParse(adSpendController.text.trim()),
          plannedInventoryPurchaseUsd: double.tryParse(inventoryController.text.trim()),
          plannedInventoryPurchaseDay: inventoryDayController.text.trim().isEmpty
              ? null
              : inventoryDayController.text.trim(),
        );
    ref.invalidate(cashProjectionProvider);
  }
}
