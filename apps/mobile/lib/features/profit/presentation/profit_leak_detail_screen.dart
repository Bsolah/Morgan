import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
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
      appBar: const MorganDetailAppBar(title: 'Profit leak', fallbackRoute: '/profit'),
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
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(leak.leakLabel, style: theme.textTheme.labelMedium),
                      const SizedBox(height: MorganSpace.xs),
                      Text(
                        '\$${leak.amountAtRiskUsd} at risk',
                        style: theme.textTheme.displaySmall?.copyWith(color: p.loss),
                      ),
                      const SizedBox(height: MorganSpace.sm),
                      Text(leak.title, style: theme.textTheme.titleMedium),
                    ],
                  ),
                ),
                const SizedBox(height: MorganSpace.lg),
                const MorganSectionHeader(title: 'Evidence'),
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final row in leak.evidenceRows)
                        Padding(
                          padding: const EdgeInsets.only(bottom: MorganSpace.xs),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('• ', style: theme.textTheme.bodyMedium?.copyWith(color: p.accent)),
                              Expanded(
                                child: Text(
                                  '${row.label}: ${row.value}',
                                  style: theme.textTheme.bodyMedium,
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (leak.evidenceRows.isEmpty && leak.body.isNotEmpty)
                        Text(leak.body, style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
                const SizedBox(height: MorganSpace.lg),
                if (leak.recommendationId.isNotEmpty)
                  MorganPrimaryButton(
                    label: 'View suggested fix',
                    onPressed: () => context.push('/recommendations/${leak.recommendationId}'),
                  )
                else if (leak.leakType.contains('inventory'))
                  MorganPrimaryButton(
                    label: 'Plan reorder scenario',
                    onPressed: () => context.push('/scenarios'),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
