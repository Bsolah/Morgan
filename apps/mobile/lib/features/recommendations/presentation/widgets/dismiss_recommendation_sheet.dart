import 'package:flutter/material.dart';

import '../../../../core/recommendations/recommendation_detail.dart';
import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';

class DismissRecommendationSheet extends StatefulWidget {
  const DismissRecommendationSheet({super.key});

  @override
  State<DismissRecommendationSheet> createState() => _DismissRecommendationSheetState();
}

class _DismissRecommendationSheetState extends State<DismissRecommendationSheet> {
  DismissReason? _selected;
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        MorganSpace.xl,
        MorganSpace.lg,
        MorganSpace.xl,
        MorganSpace.lg + bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Dismiss recommendation', style: theme.textTheme.titleLarge),
          const SizedBox(height: MorganSpace.xs),
          Text(
            'Help Morgan improve future suggestions.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: MorganSpace.md),
          ...DismissReason.values.map((reason) {
            final selected = _selected == reason;
            return ListTile(
              onTap: () => setState(() => _selected = reason),
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: selected ? p.accent : p.textMuted,
              ),
              title: Text(reason.label, style: theme.textTheme.titleSmall),
            );
          }),
          const SizedBox(height: MorganSpace.md),
          Text('Optional comment', style: theme.textTheme.labelMedium),
          const SizedBox(height: MorganSpace.xs),
          TextField(
            controller: _commentController,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'Tell Morgan more (optional)',
              filled: true,
              fillColor: p.surfaceMuted,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(MorganRadius.sm),
                borderSide: BorderSide(color: p.borderSubtle),
              ),
            ),
          ),
          const SizedBox(height: MorganSpace.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: FilledButton(
                  onPressed: _selected == null
                      ? null
                      : () => Navigator.of(context).pop(
                            DismissRecommendationSheetResult(
                              reason: _selected!,
                              comment: _commentController.text.trim().isEmpty
                                  ? null
                                  : _commentController.text.trim(),
                            ),
                          ),
                  child: const Text('Dismiss'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class DismissRecommendationSheetResult {
  const DismissRecommendationSheetResult({
    required this.reason,
    this.comment,
  });

  final DismissReason reason;
  final String? comment;
}

Future<DismissRecommendationSheetResult?> showDismissRecommendationSheet(
  BuildContext context,
) {
  return showModalBottomSheet<DismissRecommendationSheetResult>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => const DismissRecommendationSheet(),
  );
}
