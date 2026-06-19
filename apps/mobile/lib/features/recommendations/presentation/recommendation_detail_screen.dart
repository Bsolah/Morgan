import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/recommendations/recommendations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class RecommendationDetailScreen extends ConsumerWidget {
  const RecommendationDetailScreen({super.key, required this.recommendationId});

  final String recommendationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final recommendationAsync = ref.watch(recommendationDetailProvider(recommendationId));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: const Text('Recommendation'),
      ),
      body: SafeArea(
        child: recommendationAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load recommendation.', style: theme.textTheme.bodyMedium),
          ),
          data: (recommendation) {
            final impact = _formatImpact(recommendation);

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                MorganScreenHeader(
                  title: recommendation.title,
                  subtitle: '${recommendation.effort ?? 'Medium effort'} · ${recommendation.confidence ?? 'Medium'} confidence',
                ),
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('WHY THIS MATTERS', style: theme.textTheme.labelSmall),
                      const SizedBox(height: MorganSpace.sm),
                      Text(recommendation.body, style: theme.textTheme.bodyLarge),
                      if (impact.isNotEmpty) ...[
                        const SizedBox(height: MorganSpace.md),
                        Text(impact, style: theme.textTheme.titleSmall?.copyWith(color: p.profit)),
                      ],
                      const SizedBox(height: MorganSpace.md),
                      Text(
                        'Status: ${recommendation.status}',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (recommendation.status == 'open') ...[
                  const SizedBox(height: MorganSpace.lg),
                  FilledButton(
                    onPressed: () async {
                      await ref.read(recommendationsRepositoryProvider).acceptRecommendation(recommendation.id);
                      ref.invalidate(recommendationDetailProvider(recommendationId));
                    },
                    child: const Text('Accept action'),
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  OutlinedButton(
                    onPressed: () async {
                      await ref.read(recommendationsRepositoryProvider).dismissRecommendation(recommendation.id);
                      if (context.mounted) context.pop();
                    },
                    child: const Text('Dismiss'),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  String _formatImpact(Recommendation recommendation) {
    final low = recommendation.impactLowUsd;
    final high = recommendation.impactHighUsd;
    if (low == null && high == null) return '';
    final value = high ?? low ?? 0;
    return 'Estimated impact ~\$${value.round()}';
  }
}
