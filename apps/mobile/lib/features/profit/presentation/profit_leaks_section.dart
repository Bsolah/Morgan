import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ProfitLeaksSection extends ConsumerWidget {
  const ProfitLeaksSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final leaksAsync = ref.watch(profitLeaksProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const MorganSectionHeader(title: 'Active profit leaks'),
          leaksAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.only(top: MorganSpace.md),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => Padding(
              padding: const EdgeInsets.only(top: MorganSpace.sm),
              child: Text('Could not load profit leaks.', style: theme.textTheme.bodyMedium),
            ),
            data: (response) {
              final items = response?.items ?? const [];
              if (items.isEmpty) {
                final lastScan = response?.lastScanAt;
                final stamp = lastScan == null ? '' : ' Last scan ${_formatScanStamp(lastScan)}.';
                return MorganSurface(
                  child: Row(
                    children: [
                      Icon(Icons.verified_rounded, color: p.profit, size: 20),
                      const SizedBox(width: MorganSpace.sm),
                      Expanded(
                        child: Text(
                          'No active leaks detected.$stamp',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                );
              }

              return Column(
                children: items.map((item) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                    child: _LeakTile(
                      item: item,
                      onTap: () => context.push('/profit/leaks/${item.id}'),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  String _formatScanStamp(DateTime value) {
    final local = value.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $hh:$mm';
  }
}

class _LeakTile extends StatelessWidget {
  const _LeakTile({required this.item, required this.onTap});

  final ProfitLeakListItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: MorganSurface(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(_severityIcon(item.severity), color: _severityColor(p, item.severity), size: 20),
            const SizedBox(width: MorganSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title, style: theme.textTheme.titleSmall),
                  const SizedBox(height: MorganSpace.xxs),
                  Text(
                    '${item.leakLabel} · \$${item.amountAtRiskUsd} at risk',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
          ],
        ),
      ),
    );
  }

  IconData _severityIcon(String severity) {
    if (severity == 'critical') return Icons.error_outline_rounded;
    if (severity == 'info') return Icons.info_outline_rounded;
    return Icons.warning_amber_rounded;
  }

  Color _severityColor(MorganPalette p, String severity) {
    if (severity == 'critical') return p.loss;
    if (severity == 'info') return p.accent;
    return p.warning;
  }
}

