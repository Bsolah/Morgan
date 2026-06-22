import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/brief/brief_formatters.dart';
import '../../../core/brief/brief_read_tracker_provider.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/brief/brief_repository.dart';
import '../../../core/brief/brief_share_service.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_action_card.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_section_header.dart';

class BriefDetailScreen extends ConsumerStatefulWidget {
  const BriefDetailScreen({super.key, required this.date});

  final String date;

  @override
  ConsumerState<BriefDetailScreen> createState() => _BriefDetailScreenState();
}

class _BriefDetailScreenState extends ConsumerState<BriefDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
  }

  Future<void> _markRead() async {
    final storeId = ref.read(authControllerProvider).session?.storeId;
    if (storeId == null || storeId.isEmpty) return;

    final tracker = await ref.read(briefReadTrackerProvider.future);
    await tracker.markRead(storeId, widget.date);
    ref.invalidate(briefReadTrackerProvider);
  }

  String _dateTitle() {
    final parsed = DateTime.tryParse(widget.date);
    if (parsed == null) return widget.date;
    return DateFormat('EEEE, MMM d').format(parsed);
  }

  Future<void> _shareBrief(BuildContext context, DailyBrief brief) async {
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
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final briefAsync = ref.watch(briefDetailProvider(widget.date));

    return Scaffold(
      backgroundColor: p.background,
      appBar: MorganDetailAppBar(
        title: _dateTitle(),
        actions: [
          briefAsync.maybeWhen(
            data: (brief) => MorganDetailAppBarAction(
              icon: Icons.ios_share_rounded,
              tooltip: 'Share briefing',
              onPressed: () => _shareBrief(context, brief),
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
              const MorganSectionHeader(title: 'Key metrics'),
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
                  impact: formatImpactAtRisk(brief.topAction!).isEmpty
                      ? null
                      : formatImpactAtRisk(brief.topAction!),
                  onReview: () {
                    final route = topActionRoute(brief.topAction!);
                    if (route != null) context.push(route);
                  },
                  onAskMorgan: () {
                    final prompt = topActionChatPrompt(brief.topAction!);
                    context.push('/chat?prompt=${Uri.encodeComponent(prompt)}');
                  },
                ),
              ),
            ],
            const SizedBox(height: MorganSpace.lg),
            OutlinedButton.icon(
              onPressed: () => _shareBrief(context, brief),
              icon: const Icon(Icons.ios_share_rounded),
              label: const Text('Share briefing'),
            ),
          ],
        ),
      ),
    );
  }
}
