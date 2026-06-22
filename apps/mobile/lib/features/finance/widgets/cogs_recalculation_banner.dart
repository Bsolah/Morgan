import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../../../core/finance/finance_config.dart';
import '../../../core/finance/finance_repository.dart';

class CogsRecalculationBanner extends StatelessWidget {
  const CogsRecalculationBanner({super.key, required this.recalculation});

  final FinanceRecalculation recalculation;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (title, detail) = switch (recalculation.status) {
      FinanceRecalculationStatus.scheduled => (
          'Preparing margin recalculation',
          'Your profit metrics will refresh in the background.',
        ),
      FinanceRecalculationStatus.inProgress => (
          'Recalculating profit metrics',
          'This usually takes less than a minute.',
        ),
      FinanceRecalculationStatus.completed => (
          'Margin recalculation complete',
          'Your profit numbers now reflect the new COGS method.',
        ),
      FinanceRecalculationStatus.idle => ('', ''),
    };

    if (title.isEmpty) return const SizedBox.shrink();

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (recalculation.status != FinanceRecalculationStatus.completed)
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: p.accent,
                  ),
                )
              else
                Icon(Icons.check_circle_rounded, color: p.profit, size: 20),
              const SizedBox(width: MorganSpace.sm),
              Expanded(child: Text(title, style: theme.textTheme.titleSmall)),
            ],
          ),
          const SizedBox(height: MorganSpace.xs),
          Text(detail, style: theme.textTheme.bodySmall),
          if (recalculation.status != FinanceRecalculationStatus.completed) ...[
            const SizedBox(height: MorganSpace.sm),
            ClipRRect(
              borderRadius: BorderRadius.circular(MorganRadius.pill),
              child: const LinearProgressIndicator(minHeight: 6),
            ),
          ],
        ],
      ),
    );
  }
}

final financeRecalculationPollerProvider =
    StreamProvider.autoDispose<FinanceRecalculation>((ref) async* {
  final repo = ref.watch(financeRepositoryProvider);

  while (true) {
    final config = await repo.getConfig();
    yield config.recalculation;

    if (config.recalculation.status == FinanceRecalculationStatus.completed) {
      break;
    }
    if (!config.recalculation.isActive) {
      break;
    }

    await Future<void>.delayed(const Duration(seconds: 2));
  }
});
