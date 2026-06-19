import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/brief/brief_formatters.dart';
import '../../../core/brief/brief_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_surface.dart';

class BriefHistoryScreen extends ConsumerWidget {
  const BriefHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final historyAsync = ref.watch(briefHistoryListProvider);

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        elevation: 0,
        title: Text('Briefing history', style: theme.textTheme.titleLarge),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(briefHistoryListProvider.notifier).refresh(),
        color: p.accent,
        child: historyAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Padding(
                padding: const EdgeInsets.all(MorganSpace.screenH),
                child: Text(
                  'Could not load briefing history.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ],
          ),
          data: (history) {
            if (history.items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(MorganSpace.screenH),
                    child: Text(
                      'Briefings will appear here after your first morning report.',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.sm,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              itemCount: history.items.length,
              separatorBuilder: (_, __) => const SizedBox(height: MorganSpace.sm),
              itemBuilder: (context, index) {
                final item = history.items[index];
                return MorganFadeIn(
                  delay: Duration(milliseconds: 20 * index),
                  child: _BriefHistoryTile(item: item),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _BriefHistoryTile extends StatelessWidget {
  const _BriefHistoryTile({required this.item});

  final BriefHistoryListItem item;

  String _formatDateLabel() {
    final parsed = DateTime.tryParse(item.date);
    if (parsed == null) return item.date;
    return DateFormat('EEE, MMM d').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final enabled = item.hasBrief;

    return MorganSurface(
      child: InkWell(
        borderRadius: BorderRadius.circular(MorganRadius.md),
        onTap: enabled ? () => context.push('/brief/${item.date}') : null,
        child: Padding(
          padding: const EdgeInsets.all(MorganSpace.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_formatDateLabel(), style: theme.textTheme.labelMedium),
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      enabled ? (item.headline ?? 'Daily briefing') : 'No briefing',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: enabled ? p.textPrimary : p.textMuted,
                      ),
                    ),
                    if (enabled && item.version > 1) ...[
                      const SizedBox(height: MorganSpace.xxs),
                      Text(
                        'Updated · v${item.version}',
                        style: theme.textTheme.bodySmall?.copyWith(color: p.warning),
                      ),
                    ],
                  ],
                ),
              ),
              if (enabled)
                Icon(Icons.chevron_right_rounded, color: p.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
