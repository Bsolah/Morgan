import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class MarginDriversSheet {
  static Future<void> show(BuildContext context, {required int windowDays}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _MarginDriversSheet(windowDays: windowDays),
    );
  }
}

class _MarginDriversSheet extends ConsumerWidget {
  const _MarginDriversSheet({required this.windowDays});

  final int windowDays;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final driversAsync = ref.watch(marginDriversProvider(windowDays));

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
      child: driversAsync.when(
        loading: () => SizedBox(
          height: 180,
          child: Center(child: CircularProgressIndicator(color: p.accent)),
        ),
        error: (_, __) => Text('Could not explain this margin move.', style: theme.textTheme.bodyMedium),
        data: (response) {
          if (response == null || response.drivers.isEmpty) {
            return Text(
              'Driver breakdown appears once order history is synced.',
              style: theme.textTheme.bodyMedium,
            );
          }

          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Why margin moved', style: theme.textTheme.titleMedium),
              const SizedBox(height: MorganSpace.xs),
              Text(
                'Top drivers over the last ${response.windowDays} days, ranked by dollar impact.',
                style: theme.textTheme.bodySmall,
              ),
              if (response.currentMarginPct != null) ...[
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Current margin ${formatMarginPct(response.currentMarginPct)} · ${formatMarginDelta(response.marginDeltaPct)}',
                  style: theme.textTheme.labelMedium?.copyWith(color: p.textSecondary),
                ),
              ],
              const SizedBox(height: MorganSpace.lg),
              ...response.drivers.map(
                (driver) => Padding(
                  padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                  child: _DriverTile(
                    driver: driver,
                    onTap: () {
                      Navigator.of(context).pop();
                      context.go('/chat?prompt=${Uri.encodeComponent(driver.chatPrompt)}');
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DriverTile extends StatelessWidget {
  const _DriverTile({required this.driver, required this.onTap});

  final MarginDriver driver;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final impactColor = driver.impactUsd >= 0 ? p.profit : p.loss;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(MorganRadius.sm),
        child: Container(
          padding: const EdgeInsets.all(MorganSpace.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(MorganRadius.sm),
            border: Border.all(color: p.borderSubtle),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driver.label, style: theme.textTheme.titleSmall),
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      'Current ${formatProfitCurrency(driver.currentUsd.toDouble())} vs prior ${formatProfitCurrency(driver.priorUsd.toDouble())}',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: MorganSpace.sm),
              Text(
                formatDriverImpact(driver.impactUsd),
                style: theme.textTheme.titleSmall?.copyWith(color: impactColor, fontWeight: FontWeight.w600),
              ),
              const SizedBox(width: MorganSpace.xs),
              Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
