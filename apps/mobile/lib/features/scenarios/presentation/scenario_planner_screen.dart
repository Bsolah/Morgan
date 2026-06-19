import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/scenarios/scenarios_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ScenarioPlannerScreen extends ConsumerWidget {
  const ScenarioPlannerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final scenariosAsync = ref.watch(savedScenariosProvider);

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: const Text('Scenario Planner'),
      ),
      body: SafeArea(
        child: scenariosAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load saved scenarios.', style: theme.textTheme.bodyMedium),
          ),
          data: (scenarios) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                const MorganScreenHeader(
                  title: 'Saved scenarios',
                  subtitle: 'What-if models from chat and the planner',
                ),
                if (scenarios.isEmpty)
                  MorganSurface(
                    child: Text(
                      'No saved scenarios yet. Ask Morgan a what-if question in chat and tap Save.',
                      style: theme.textTheme.bodyMedium,
                    ),
                  )
                else
                  ...scenarios.map(
                    (scenario) => Padding(
                      padding: const EdgeInsets.only(bottom: MorganSpace.md),
                      child: MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(scenario.title, style: theme.textTheme.titleMedium),
                            if (scenario.spendChangePct != null) ...[
                              const SizedBox(height: MorganSpace.xs),
                              Text(
                                '${scenario.channel ?? 'ads'} ${scenario.spendChangePct! >= 0 ? '+' : ''}${scenario.spendChangePct!.round()}%',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
