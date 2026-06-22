import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/recommendations/recommendation_detail.dart';
import '../../../core/recommendations/recommendations_providers.dart';
import '../../../core/recommendations/recommendations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/haptics/morgan_haptics.dart';
import '../../../core/theme/morgan_motion.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_empty_state.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import 'widgets/dismiss_recommendation_sheet.dart';
import 'widgets/recommendation_card.dart';

class RecommendationsScreen extends ConsumerStatefulWidget {
  const RecommendationsScreen({super.key});

  static const _emptyTitle = 'All clear for now';
  static const _emptyMessage =
      'Morgan will suggest actions when opportunities appear in your data.';

  static const _subtitle = 'Ranked by estimated impact';

  @override
  ConsumerState<RecommendationsScreen> createState() => _RecommendationsScreenState();
}

class _RecommendationsScreenState extends ConsumerState<RecommendationsScreen> {
  String? _actingId;

  Future<void> _accept(String id) async {
    setState(() => _actingId = id);
    try {
      final session = await ref.read(authSessionProvider.future);
      if (session != null) {
        try {
          await RecommendationsRepository(session).accept(id);
        } catch (_) {
          if (AppConfig.canSkipSetup) {
            RecommendationsRepository.acceptLocally(id);
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
      if (!mounted) return;
      MorganHaptics.lightImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Got it — we'll track the impact over the next 30 days"),
        ),
      );
    } finally {
      if (mounted) setState(() => _actingId = null);
    }
  }

  Future<void> _dismiss(String id) async {
    final result = await showDismissRecommendationSheet(context);
    if (result == null || !mounted) return;

    setState(() => _actingId = id);
    try {
      final session = await ref.read(authSessionProvider.future);
      if (session != null) {
        try {
          await RecommendationsRepository(session).dismiss(
            recommendationId: id,
            reason: result.reason,
            comment: result.comment,
          );
        } catch (_) {
          if (AppConfig.canSkipSetup) {
            RecommendationsRepository.dismissLocally(id);
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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks — we\'ll improve future suggestions')),
      );
    } finally {
      if (mounted) setState(() => _actingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final feed = ref.watch(recommendationsProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: p.accent,
          onRefresh: () async {
            ref.invalidate(recommendationsProvider);
            await ref.read(recommendationsProvider.future);
          },
          child: feed.when(
            loading: () => CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                const SliverToBoxAdapter(
                  child: MorganScreenHeader(
                    title: 'Actions',
                    subtitle: RecommendationsScreen._subtitle,
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    MorganSpace.screenH,
                    0,
                    MorganSpace.screenH,
                    MorganSpace.huge,
                  ),
                  sliver: const SliverToBoxAdapter(
                    child: MorganRecommendationsListSkeleton(),
                  ),
                ),
              ],
            ),
            error: (error, _) => CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                const SliverToBoxAdapter(
                  child: MorganScreenHeader(
                    title: 'Actions',
                    subtitle: RecommendationsScreen._subtitle,
                  ),
                ),
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                    child: MorganErrorState(
                      error: error,
                      fallbackMessage: 'Could not load recommendations.',
                      onRetry: () {
                        ref.invalidate(recommendationsProvider);
                      },
                    ),
                  ),
                ),
              ],
            ),
            data: (data) {
              if (data.isEmpty) {
                return CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    const SliverToBoxAdapter(
                      child: MorganScreenHeader(
                        title: 'Actions',
                        subtitle: RecommendationsScreen._subtitle,
                      ),
                    ),
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                        child: MorganEmptyState(
                          icon: Icons.insights_outlined,
                          title: RecommendationsScreen._emptyTitle,
                          message: RecommendationsScreen._emptyMessage,
                          actionLabel: 'Ask Morgan what to focus on',
                          onAction: () => context.go('/chat'),
                        ),
                      ),
                    ),
                  ],
                );
              }

              return CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  const SliverToBoxAdapter(
                    child: MorganScreenHeader(
                      title: 'Actions',
                      subtitle: RecommendationsScreen._subtitle,
                    ),
                  ),
                  if (data.inProgress.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          MorganSpace.screenH,
                          0,
                          MorganSpace.screenH,
                          MorganSpace.sm,
                        ),
                        child: Text('IN PROGRESS', style: theme.textTheme.labelMedium),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        MorganSpace.screenH,
                        0,
                        MorganSpace.screenH,
                        MorganSpace.md,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final item = data.inProgress[index];
                            return Padding(
                              padding: EdgeInsets.only(
                                bottom: index < data.inProgress.length - 1 ? MorganSpace.sm : 0,
                              ),
                              child: RecommendationCard(
                                recommendation: item,
                                inProgress: true,
                                onTap: () => context.push('/recommendations/${item.id}'),
                              ),
                            );
                          },
                          childCount: data.inProgress.length,
                        ),
                      ),
                    ),
                  ],
                  if (data.open.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          MorganSpace.screenH,
                          data.inProgress.isNotEmpty ? MorganSpace.sm : 0,
                          MorganSpace.screenH,
                          MorganSpace.sm,
                        ),
                        child: Text('RECOMMENDED', style: theme.textTheme.labelMedium),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        MorganSpace.screenH,
                        0,
                        MorganSpace.screenH,
                        MorganSpace.huge,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            if (index == data.open.length) {
                              if (data.archivedCount <= 0) return null;
                              return Padding(
                                padding: const EdgeInsets.only(top: MorganSpace.md),
                                child: Text(
                                  '${data.archivedCount} more archived',
                                  style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
                                  textAlign: TextAlign.center,
                                ),
                              );
                            }

                            final item = data.open[index];
                            return Padding(
                              padding: EdgeInsets.only(
                                bottom: index < data.open.length - 1 ? MorganSpace.sm : 0,
                              ),
                              child: MorganFadeIn(
                                delay: MorganMotion.listStaggerDelay(
                                  index,
                                  step: const Duration(milliseconds: 60),
                                ),
                                child: RecommendationCard(
                                  recommendation: item,
                                  acting: _actingId == item.id,
                                  onTap: () => context.push('/recommendations/${item.id}'),
                                  onAccept: () => _accept(item.id),
                                  onDismiss: () => _dismiss(item.id),
                                ),
                              ),
                            );
                          },
                          childCount: data.open.length + (data.archivedCount > 0 ? 1 : 0),
                        ),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
