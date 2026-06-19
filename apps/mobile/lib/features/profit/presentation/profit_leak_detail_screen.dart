import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ProfitLeakDetailScreen extends ConsumerWidget {
  const ProfitLeakDetailScreen({super.key, required this.leakId});

  final String leakId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final leakAsync = ref.watch(profitLeakDetailProvider(leakId));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: const Text('Profit leak'),
      ),
      body: SafeArea(
        child: leakAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load leak detail.', style: theme.textTheme.bodyMedium),
          ),
          data: (leak) {
            if (leak == null) {
              return Center(child: Text('Leak not found.', style: theme.textTheme.bodyMedium));
            }

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                MorganScreenHeader(
                  title: leak.title,
                  subtitle: '${leak.leakLabel} · \$${leak.amountAtRiskUsd} at risk',
                ),
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('EVIDENCE', style: theme.textTheme.labelSmall),
                      const SizedBox(height: MorganSpace.sm),
                      Text(leak.body, style: theme.textTheme.bodyLarge),
                      if (leak.evidenceRows.isNotEmpty) ...[
                        const SizedBox(height: MorganSpace.md),
                        ...leak.evidenceRows.map((row) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: MorganSpace.xs),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: Text(row.label, style: theme.textTheme.bodySmall),
                                ),
                                const SizedBox(width: MorganSpace.sm),
                                Expanded(
                                  flex: 3,
                                  child: Text(
                                    row.value,
                                    style: theme.textTheme.bodySmall?.copyWith(color: p.textPrimary),
                                    textAlign: TextAlign.right,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: MorganSpace.lg),
                FilledButton(
                  onPressed: () => context.push('/recommendations/${leak.recommendationId}'),
                  child: const Text('View recommendation'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

