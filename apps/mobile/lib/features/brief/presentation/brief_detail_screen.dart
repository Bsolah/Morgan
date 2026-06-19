import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/brief/brief_formatters.dart';
import '../../../core/brief/brief_repository.dart';
import '../../../core/brief/brief_share_service.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_action_card.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_metric_card.dart';

class BriefDetailScreen extends ConsumerWidget {
  const BriefDetailScreen({super.key, required this.date});

  final String date;

  String _dateTitle() {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return date;
    return DateFormat('EEEE, MMM d').format(parsed);
  }

  Future<void> _shareBrief(BuildContext context, WidgetRef ref, DailyBrief brief) async {
    final shareService = ref.read(briefShareServiceProvider);
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.text_snippet_outlined),
              title: const Text('Share as text'),
              onTap: () => Navigator.pop(context, 'text'),
            ),
            ListTile(
              leading: const Icon(Icons.picture_as_pdf_outlined),
              title: const Text('Share as PDF'),
              onTap: () => Navigator.pop(context, 'pdf'),
            ),
          ],
        ),
      ),
    );

    if (choice == null || !context.mounted) return;

    try {
      if (choice == 'pdf') {
        await shareService.shareAsPdf(brief);
      } else {
        await shareService.shareAsText(brief);
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not share this briefing.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final briefAsync = ref.watch(briefDetailProvider(date));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        elevation: 0,
        title: Text(_dateTitle(), style: theme.textTheme.titleMedium),
        actions: [
          briefAsync.maybeWhen(
            data: (brief) => IconButton(
              icon: const Icon(Icons.ios_share_rounded),
              tooltip: 'Share briefing',
              onPressed: () => _shareBrief(context, ref, brief),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: briefAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(MorganSpace.screenH),
            child: Text(
              'This briefing is not available offline yet.',
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ),
        ),
        data: (brief) => ListView(
          padding: const EdgeInsets.fromLTRB(
            MorganSpace.screenH,
            MorganSpace.sm,
            MorganSpace.screenH,
            MorganSpace.huge,
          ),
          children: [
            MorganFadeIn(
              child: MorganBriefCard(
                dateLabel: formatBriefingDateLabel(brief),
                headline: brief.headline,
                narrative: brief.narrative,
                expandAll: true,
              ),
            ),
            if (brief.kpiDeltas.isNotEmpty) ...[
              const SizedBox(height: MorganSpace.lg),
              Text('Key metrics', style: theme.textTheme.titleSmall),
              const SizedBox(height: MorganSpace.sm),
              Wrap(
                spacing: MorganSpace.sm,
                runSpacing: MorganSpace.sm,
                children: brief.kpiDeltas.map((delta) {
                  final isProfit = delta.key.contains('margin') || delta.key.contains('profit');
                  return SizedBox(
                    width: (MediaQuery.sizeOf(context).width - (MorganSpace.screenH * 2) - MorganSpace.sm) / 2,
                    child: MorganMetricCard(
                      label: delta.label,
                      value: formatKpiValue(delta),
                      delta: formatKpiDelta(delta),
                      trend: kpiTrend(delta, higherIsBetter: isProfit),
                    ),
                  );
                }).toList(),
              ),
            ],
            if (brief.topAction != null) ...[
              const SizedBox(height: MorganSpace.lg),
              MorganFadeIn(
                child: MorganActionCard(
                  title: brief.topAction!.title,
                  body: brief.topAction!.body,
                  impact: formatImpactRange(brief.topAction!).isEmpty
                      ? null
                      : formatImpactRange(brief.topAction!),
                ),
              ),
            ],
            const SizedBox(height: MorganSpace.lg),
            OutlinedButton.icon(
              onPressed: () => _shareBrief(context, ref, brief),
              icon: const Icon(Icons.ios_share_rounded),
              label: const Text('Share briefing'),
            ),
          ],
        ),
      ),
    );
  }
}
