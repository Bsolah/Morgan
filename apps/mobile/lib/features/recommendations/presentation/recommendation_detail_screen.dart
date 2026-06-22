import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/recommendations/recommendation.dart';
import '../../../core/recommendations/recommendation_detail.dart';
import '../../../core/recommendations/recommendations_providers.dart';
import '../../../core/recommendations/recommendations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/haptics/morgan_haptics.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'widgets/dismiss_recommendation_sheet.dart';

class RecommendationDetailScreen extends ConsumerStatefulWidget {
  const RecommendationDetailScreen({super.key, required this.recommendationId});

  final String recommendationId;

  @override
  ConsumerState<RecommendationDetailScreen> createState() =>
      _RecommendationDetailScreenState();
}

class _RecommendationDetailScreenState extends ConsumerState<RecommendationDetailScreen> {
  bool _acting = false;

  Future<void> _accept() async {
    setState(() => _acting = true);
    try {
      final session = await ref.read(authSessionProvider.future);
      if (session != null) {
        try {
          await RecommendationsRepository(session).accept(widget.recommendationId);
        } catch (_) {
          if (AppConfig.canSkipSetup) {
            RecommendationsRepository.acceptLocally(widget.recommendationId);
          } else {
            if (!mounted) return;
            showMorganSaveErrorSnackBar(
              context,
              message: 'Could not save your response. Try again.',
            );
            return;
          }
        }
      }
      ref.invalidate(recommendationsProvider);
      ref.invalidate(recommendationDetailProvider(widget.recommendationId));
      if (!mounted) return;
      MorganHaptics.lightImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Got it — we'll track the impact over the next 30 days"),
        ),
      );
      context.pop();
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _dismiss() async {
    final result = await showDismissRecommendationSheet(context);
    if (result == null || !mounted) return;

    setState(() => _acting = true);
    try {
      final session = await ref.read(authSessionProvider.future);
      if (session != null) {
        try {
          await RecommendationsRepository(session).dismiss(
            recommendationId: widget.recommendationId,
            reason: result.reason,
            comment: result.comment,
          );
        } catch (_) {
          if (AppConfig.canSkipSetup) {
            RecommendationsRepository.dismissLocally(widget.recommendationId);
          } else {
            if (!mounted) return;
            showMorganSaveErrorSnackBar(
              context,
              message: 'Could not save your response. Try again.',
            );
            return;
          }
        }
      }
      ref.invalidate(recommendationsProvider);
      ref.invalidate(recommendationDetailProvider(widget.recommendationId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks — we\'ll improve future suggestions')),
      );
      context.pop();
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  void _openRelated(RecommendationRelatedLink related) {
    switch (related.type) {
      case RelatedLinkType.leak:
        context.push('/alerts/${related.id}');
      case RelatedLinkType.metric:
        if (related.id.contains('inventory')) {
          context.push('/inventory');
        } else if (related.id.contains('margin') || related.id.contains('profit')) {
          context.push('/profit');
        } else if (related.id.contains('cash')) {
          context.push('/cash');
        } else {
          context.push('/marketing');
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final detail = ref.watch(recommendationDetailProvider(widget.recommendationId));

    return Scaffold(
      backgroundColor: p.background,
      appBar: const MorganDetailAppBar(title: 'Recommendation', fallbackRoute: '/recommendations'),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(MorganSpace.screenH),
            child: MorganErrorState(
              error: error,
              fallbackMessage: 'Could not load recommendation.',
              onRetry: () => ref.invalidate(recommendationDetailProvider(widget.recommendationId)),
            ),
          ),
        ),
        data: (item) {
          final isAccepted = item.isInProgress;
          final steps = item.suggestedSteps.isNotEmpty
              ? item.suggestedSteps
              : _defaultStepsForCategory(item.category);

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    MorganSpace.screenH,
                    MorganSpace.sm,
                    MorganSpace.screenH,
                    MorganSpace.lg,
                  ),
                  children: [
                    if (isAccepted) ...[
                      MorganSurface(
                        color: p.accentMuted,
                        child: Row(
                          children: [
                            Icon(Icons.timelapse_rounded, color: p.accent, size: 20),
                            const SizedBox(width: MorganSpace.sm),
                            Expanded(
                              child: Text(
                                'In progress — tracking impact over 30 days',
                                style: theme.textTheme.titleSmall?.copyWith(color: p.accent),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: MorganSpace.md),
                    ],
                    MorganSurface(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.title, style: theme.textTheme.headlineSmall),
                          const SizedBox(height: MorganSpace.sm),
                          Text(
                            item.impactRangeLabel,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: impactColorForUsd(p, item.impactHighUsd),
                              fontSize: 28,
                            ),
                          ),
                          const SizedBox(height: MorganSpace.xs),
                          _ConfidenceIndicator(confidence: item.confidence),
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.lg),
                    MorganSurface(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Why', style: theme.textTheme.titleSmall),
                          const SizedBox(height: MorganSpace.sm),
                          Text(item.description, style: theme.textTheme.bodyMedium),
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.md),
                    _RecommendationSection(
                      title: 'Evidence',
                      initiallyExpanded: false,
                      child: Column(
                        children: [
                          for (var i = 0; i < item.evidence.length; i++) ...[
                            if (i > 0) Divider(height: 1, color: p.borderSubtle),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: MorganSpace.sm),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: p.accent,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: MorganSpace.sm),
                                  Expanded(
                                    child: Text(
                                      item.evidence[i],
                                      style: theme.textTheme.bodyMedium,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.md),
                    _RecommendationSection(
                      title: 'Suggested steps',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (var i = 0; i < steps.length; i++)
                            Padding(
                              padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${i + 1}.',
                                    style: theme.textTheme.labelMedium?.copyWith(color: p.accent),
                                  ),
                                  const SizedBox(width: MorganSpace.sm),
                                  Expanded(
                                    child: Text(steps[i], style: theme.textTheme.bodyMedium),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.md),
                    _RecommendationSection(
                      title: 'How we calculated this',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.calculation.summary, style: theme.textTheme.bodyMedium),
                          const SizedBox(height: MorganSpace.md),
                          for (final citation in item.calculation.citations) ...[
                            Text(citation.label, style: theme.textTheme.labelMedium),
                            const SizedBox(height: MorganSpace.xxs),
                            Row(
                              children: [
                                Text(
                                  citation.value,
                                  style: theme.textTheme.titleSmall?.copyWith(color: p.accent),
                                ),
                                const Spacer(),
                                Text(
                                  citation.period,
                                  style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
                                ),
                              ],
                            ),
                            const SizedBox(height: MorganSpace.sm),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.lg),
                    Text('Related', style: theme.textTheme.titleMedium),
                    const SizedBox(height: MorganSpace.sm),
                    MorganSurface(
                      padding: EdgeInsets.zero,
                      child: ListTile(
                        onTap: () => _openRelated(item.related),
                        title: Text(item.related.label, style: theme.textTheme.titleSmall),
                        subtitle: Text(item.related.headline),
                        trailing: Icon(
                          item.related.type == RelatedLinkType.leak
                              ? Icons.water_drop_outlined
                              : Icons.show_chart_rounded,
                          color: p.accent,
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (!isAccepted)
                _BottomActions(
                  acting: _acting,
                  onAccept: _accept,
                  onDismiss: _dismiss,
                ),
            ],
          );
        },
      ),
    );
  }

  List<String> _defaultStepsForCategory(RecommendationCategory category) {
    return switch (category) {
      RecommendationCategory.adWaste => const [
          'Review the underperforming campaign metrics',
          'Pause or reduce spend on the flagged campaign',
          'Reallocate budget to higher-POAS channels',
        ],
      RecommendationCategory.inventory => const [
          'Verify on-hand inventory and open purchase orders',
          'Place a reorder before cover drops below safety stock',
          'Set a low-stock alert for this SKU',
        ],
      RecommendationCategory.pricing => const [
          'Audit active discount and promo rules',
          'Remove or restrict overlapping discount codes',
          'Monitor margin on affected SKUs for two weeks',
        ],
      RecommendationCategory.cashFlow => const [
          'Review cash outflows for the next 30 days',
          'Identify deferrable or reducible expenses',
          'Update your cash forecast after changes',
        ],
      RecommendationCategory.margin => const [
          'Review margin drivers for the affected period',
          'Address the highest-impact cost or revenue leak',
          'Track contribution margin over the next week',
        ],
    };
  }
}

class _ConfidenceIndicator extends StatelessWidget {
  const _ConfidenceIndicator({required this.confidence});

  final RecommendationConfidence confidence;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final color = switch (confidence) {
      RecommendationConfidence.high => p.profit,
      RecommendationConfidence.low => p.warning,
      RecommendationConfidence.medium => p.accent,
    };

    return Row(
      children: [
        Icon(Icons.verified_outlined, size: 16, color: color),
        const SizedBox(width: MorganSpace.xxs),
        Text(
          switch (confidence) {
            RecommendationConfidence.high => 'High confidence',
            RecommendationConfidence.medium => 'Medium confidence',
            RecommendationConfidence.low => 'Low confidence',
          },
          style: theme.textTheme.labelMedium?.copyWith(color: color),
        ),
      ],
    );
  }
}

class _RecommendationSection extends StatelessWidget {
  const _RecommendationSection({
    required this.title,
    required this.child,
    this.initiallyExpanded = false,
  });

  final String title;
  final Widget child;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      padding: EdgeInsets.zero,
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: MorganSpace.card),
          childrenPadding: const EdgeInsets.fromLTRB(
            MorganSpace.card,
            0,
            MorganSpace.card,
            MorganSpace.card,
          ),
          title: Text(title, style: theme.textTheme.titleSmall),
          iconColor: p.textMuted,
          collapsedIconColor: p.textMuted,
          children: [child],
        ),
      ),
    );
  }
}

class _BottomActions extends StatelessWidget {
  const _BottomActions({
    required this.acting,
    required this.onAccept,
    required this.onDismiss,
  });

  final bool acting;
  final VoidCallback onAccept;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Container(
      decoration: BoxDecoration(
        color: p.surface,
        border: Border(top: BorderSide(color: p.borderSubtle)),
        boxShadow: MorganElevation.card(p.isDark),
      ),
      padding: EdgeInsets.fromLTRB(
        MorganSpace.screenH,
        MorganSpace.md,
        MorganSpace.screenH,
        MorganSpace.md + MediaQuery.paddingOf(context).bottom,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextButton(
              onPressed: acting ? null : onDismiss,
              style: TextButton.styleFrom(
                minimumSize: const Size(0, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(MorganRadius.sm),
                ),
              ),
              child: const Text('Dismiss'),
            ),
          ),
          const SizedBox(width: MorganSpace.sm),
          Expanded(
            flex: 2,
            child: MorganPrimaryButton(
              label: acting ? 'Saving…' : 'Accept',
              onPressed: acting ? () {} : onAccept,
            ),
          ),
        ],
      ),
    );
  }
}
