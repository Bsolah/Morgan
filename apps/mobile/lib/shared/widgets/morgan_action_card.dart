import 'package:flutter/material.dart';

import '../../core/brief/brief_formatters.dart';
import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_surface.dart';

class MorganActionCard extends StatelessWidget {
  const MorganActionCard({
    super.key,
    required this.title,
    required this.body,
    this.impact,
    this.onReview,
    this.onAskMorgan,
    this.icon = Icons.bolt_rounded,
  });

  final String title;
  final String body;
  final String? impact;
  final VoidCallback? onReview;
  final VoidCallback? onAskMorgan;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      color: p.goldMuted,
      borderColor: p.isDark ? p.gold.withValues(alpha: 0.25) : p.gold.withValues(alpha: 0.15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onReview,
              borderRadius: BorderRadius.circular(MorganRadius.sm),
              child: Padding(
                padding: const EdgeInsets.only(bottom: MorganSpace.xs),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: p.gold.withValues(alpha: p.isDark ? 0.2 : 0.15),
                            borderRadius: BorderRadius.circular(MorganRadius.xs),
                          ),
                          child: Icon(icon, size: 18, color: p.gold),
                        ),
                        const SizedBox(width: MorganSpace.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Recommended action',
                                style: theme.textTheme.labelMedium?.copyWith(color: p.gold),
                              ),
                              Text(title, style: theme.textTheme.titleMedium),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: MorganSpace.sm),
                    Text(
                      body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: p.textPrimary.withValues(alpha: 0.85),
                      ),
                    ),
                    if (impact != null) ...[
                      const SizedBox(height: MorganSpace.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: MorganSpace.sm,
                          vertical: MorganSpace.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: p.lossMuted,
                          borderRadius: BorderRadius.circular(MorganRadius.xs),
                        ),
                        child: Text(
                          impact!,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: p.loss,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (onAskMorgan != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onAskMorgan,
                child: const Text('Ask Morgan'),
              ),
            ),
        ],
      ),
    );
  }
}

class MorganBriefCard extends StatefulWidget {
  const MorganBriefCard({
    super.key,
    required this.headline,
    required this.narrative,
    this.dateLabel,
    this.isEmpty = false,
    this.emptyMessage,
    this.expandAll = false,
    this.headlineMaxLines,
    this.narrativeMaxLines,
  });

  final String headline;
  final String narrative;
  final String? dateLabel;
  final bool isEmpty;
  final String? emptyMessage;
  final bool expandAll;
  final int? headlineMaxLines;
  final int? narrativeMaxLines;

  @override
  State<MorganBriefCard> createState() => _MorganBriefCardState();
}

class _MorganBriefCardState extends State<MorganBriefCard> {
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _expanded = widget.expandAll;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final baseStyle = theme.textTheme.bodyMedium!;
    final useLineClamp = widget.narrativeMaxLines != null && !widget.isEmpty && !widget.expandAll;
    final narrativeText = widget.isEmpty
        ? (widget.emptyMessage ?? widget.narrative)
        : widget.narrative.trim();

    return MorganSurface(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final showReadMore = !widget.isEmpty &&
              !widget.expandAll &&
              !_expanded &&
              (useLineClamp
                  ? briefNarrativeExceedsMaxLines(
                      text: narrativeText,
                      style: baseStyle,
                      lossColor: p.loss,
                      maxWidth: constraints.maxWidth,
                      maxLines: widget.narrativeMaxLines!,
                    )
                  : _isTruncated(narrativeText));

          final visibleNarrative = widget.isEmpty
              ? narrativeText
              : (_expanded || useLineClamp || !showReadMore
                  ? narrativeText
                  : _preview(narrativeText));

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: MorganSpace.xs),
                  Text('DAILY BRIEF', style: theme.textTheme.labelMedium),
                  const Spacer(),
                  if (widget.dateLabel != null)
                    Text(widget.dateLabel!, style: theme.textTheme.bodySmall),
                ],
              ),
              const SizedBox(height: MorganSpace.sm),
              Text(
                widget.headline,
                maxLines: widget.headlineMaxLines,
                overflow: widget.headlineMaxLines != null ? TextOverflow.ellipsis : null,
                style: theme.textTheme.titleMedium?.copyWith(height: 1.35),
              ),
              if (visibleNarrative.isNotEmpty) ...[
                const SizedBox(height: MorganSpace.xs),
                RichText(
                  maxLines: useLineClamp && !_expanded ? widget.narrativeMaxLines : null,
                  overflow: useLineClamp && !_expanded ? TextOverflow.ellipsis : TextOverflow.visible,
                  text: TextSpan(
                    style: baseStyle,
                    children: buildBriefNarrativeSpans(
                      text: visibleNarrative,
                      baseStyle: baseStyle,
                      lossColor: p.loss,
                    ),
                  ),
                ),
              ],
              if (showReadMore)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => setState(() => _expanded = true),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Read more'),
                  ),
                ),
              if (_expanded && (useLineClamp ? narrativeText.isNotEmpty : _isTruncated(narrativeText)))
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => setState(() => _expanded = false),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Show less'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  bool _isTruncated(String narrative) {
    return narrative.trim().length > briefNarrativePreviewChars;
  }

  String _preview(String narrative) {
    return briefNarrativePreview(narrative);
  }
}
