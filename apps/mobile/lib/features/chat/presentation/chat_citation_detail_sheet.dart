import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../core/chat/chat_models.dart';

class ChatCitationDetailSheet extends StatelessWidget {
  const ChatCitationDetailSheet({super.key, required this.citation});

  final ChatCitation citation;

  static Future<void> show(BuildContext context, ChatCitation citation) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatCitationDetailSheet(citation: citation),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final rawEntries = citation.rawValues.entries.toList();

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          MorganSpace.screenH,
          MorganSpace.sm,
          MorganSpace.screenH,
          MorganSpace.lg,
        ),
        child: Material(
          color: p.surface,
          borderRadius: BorderRadius.circular(MorganRadius.lg),
          child: Padding(
            padding: const EdgeInsets.all(MorganSpace.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${citation.displaySource} · ${citation.displayDate}',
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    if (citation.isStaleNow)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: MorganSpace.sm,
                          vertical: MorganSpace.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: p.warning.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(MorganRadius.pill),
                        ),
                        child: Text(
                          'Stale',
                          style: theme.textTheme.labelSmall?.copyWith(color: p.warning),
                        ),
                      ),
                  ],
                ),
                if (citation.dataAsOf != null) ...[
                  const SizedBox(height: MorganSpace.xs),
                  Text(
                    'Data as of ${_formatTimestamp(citation.dataAsOf!)}',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: MorganSpace.md),
                Text('QUERY', style: theme.textTheme.labelSmall),
                const SizedBox(height: MorganSpace.xs),
                Text(
                  citation.querySummary ?? 'Store-scoped metric query from Morgan serving tables.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: MorganSpace.lg),
                Text('RAW VALUES', style: theme.textTheme.labelSmall),
                const SizedBox(height: MorganSpace.sm),
                if (rawEntries.isEmpty)
                  Text('No raw values available for this citation.', style: theme.textTheme.bodySmall)
                else
                  ...rawEntries.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 2,
                            child: Text(entry.key, style: theme.textTheme.bodySmall?.copyWith(color: p.textSecondary)),
                          ),
                          Expanded(
                            flex: 3,
                            child: Text(
                              _formatRawValue(entry.value),
                              style: theme.textTheme.bodyMedium,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatTimestamp(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('MMM d, yyyy · h:mm a').format(parsed.toLocal());
  }

  String _formatRawValue(Object? value) {
    if (value == null) return '—';
    if (value is num) {
      if (value is int || value == value.roundToDouble()) {
        return value.round().toString();
      }
      return value.toStringAsFixed(2);
    }
    return value.toString();
  }
}
