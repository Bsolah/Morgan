import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/recommendations/recommendation_detail.dart';
import '../../../core/recommendations/recommendations_providers.dart';
import '../../../core/recommendations/recommendations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
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
          }
        }
      }
      ref.invalidate(recommendationsProvider);
      ref.invalidate(recommendationDetailProvider(widget.recommendationId));
      if (!mounted) return;
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
        context.go('/alerts');
      case RelatedLinkType.metric:
        context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final detail = ref.watch(recommendationDetailProvider(widget.recommendationId));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        elevation: 0,
        title: const Text('Recommendation'),
      ),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: Text('Could not load recommendation', style: theme.textTheme.bodyLarge),
        ),
        data: (item) {
          final deadline = DateFormat('EEEE, MMM d').format(item.suggestedDeadline);
          final isAccepted = item.isInProgress;

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    MorganSpace.screenH,
                    0,
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
                    Text(item.title, style: theme.textTheme.headlineSmall),
                    const SizedBox(height: MorganSpace.sm),
                    Text(item.description, style: theme.textTheme.bodyLarge),
                    const SizedBox(height: MorganSpace.lg),
                    _SummaryRow(
                      label: 'Impact range',
                      value: item.impactRangeLabel,
                      valueColor: p.profit,
                    ),
                    const SizedBox(height: MorganSpace.sm),
                    _SummaryRow(
                      label: 'Confidence',
                      value: item.confidenceLabel,
                    ),
                    const SizedBox(height: MorganSpace.sm),
                    _SummaryRow(
                      label: 'Suggested deadline',
                      value: deadline,
                    ),
                    const SizedBox(height: MorganSpace.xl),
                    Text('Evidence', style: theme.textTheme.titleMedium),
                    const SizedBox(height: MorganSpace.sm),
                    MorganSurface(
                      padding: const EdgeInsets.symmetric(
                        horizontal: MorganSpace.card,
                        vertical: MorganSpace.sm,
                      ),
                      child: Column(
                        children: [
                          for (var i = 0; i < item.evidence.length; i++) ...[
                            if (i > 0)
                              Divider(height: 1, color: p.borderSubtle),
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
                    const SizedBox(height: MorganSpace.lg),
                    MorganSurface(
                      padding: EdgeInsets.zero,
                      child: Theme(
                        data: theme.copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: const EdgeInsets.symmetric(
                            horizontal: MorganSpace.card,
                          ),
                          title: Text(
                            'How we calculated this',
                            style: theme.textTheme.titleSmall,
                          ),
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                MorganSpace.card,
                                0,
                                MorganSpace.card,
                                MorganSpace.card,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.calculation.summary,
                                    style: theme.textTheme.bodyMedium,
                                  ),
                                  const SizedBox(height: MorganSpace.md),
                                  for (final citation in item.calculation.citations) ...[
                                    Text(
                                      citation.label,
                                      style: theme.textTheme.labelMedium,
                                    ),
                                    const SizedBox(height: MorganSpace.xxs),
                                    Row(
                                      children: [
                                        Text(
                                          citation.value,
                                          style: theme.textTheme.titleSmall?.copyWith(
                                            color: p.accent,
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(
                                          citation.period,
                                          style: theme.textTheme.bodySmall?.copyWith(
                                            color: p.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: MorganSpace.sm),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
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
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted)),
        ),
        Text(
          value,
          style: theme.textTheme.titleSmall?.copyWith(color: valueColor),
        ),
      ],
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
            child: OutlinedButton(
              onPressed: acting ? null : onDismiss,
              style: OutlinedButton.styleFrom(
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
