import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/recommendations/recommendations_providers.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import 'widgets/recommendation_card.dart';

class RecommendationsScreen extends ConsumerWidget {
  const RecommendationsScreen({super.key});

  static const _emptyMessage = "You're all caught up — check back after tomorrow's brief";

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
            loading: () => const CustomScrollView(
              physics: AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator()),
                ),
              ],
            ),
            error: (error, _) => CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                const SliverToBoxAdapter(
                  child: MorganScreenHeader(
                    title: 'Actions',
                    subtitle: 'Ranked by profit impact',
                  ),
                ),
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                    child: Text('Could not load recommendations. Pull to retry.'),
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
                        subtitle: 'Ranked by profit impact',
                      ),
                    ),
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_outline_rounded, size: 48, color: p.accent),
                            const SizedBox(height: MorganSpace.md),
                            Text(
                              _emptyMessage,
                              textAlign: TextAlign.center,
                              style: theme.textTheme.titleMedium,
                            ),
                          ],
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
                      subtitle: 'Ranked by profit impact',
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
                                delay: Duration(milliseconds: 60 * index),
                                child: RecommendationCard(
                                  recommendation: item,
                                  onTap: () => context.push('/recommendations/${item.id}'),
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
