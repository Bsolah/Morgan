import 'package:flutter/material.dart';

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
    this.icon = Icons.bolt_rounded,
  });

  final String title;
  final String body;
  final String? impact;
  final VoidCallback? onReview;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      color: p.goldMuted,
      borderColor: p.isDark ? p.gold.withValues(alpha: 0.25) : const Color(0xFFE8DFC8),
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
                    Text('Recommended action', style: theme.textTheme.labelMedium?.copyWith(color: p.gold)),
                    Text(title, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(body, style: theme.textTheme.bodyMedium?.copyWith(color: p.textPrimary.withValues(alpha: 0.85))),
          if (impact != null) ...[
            const SizedBox(height: MorganSpace.sm),
            Text(
              impact!,
              style: theme.textTheme.titleSmall?.copyWith(color: p.profit, fontWeight: FontWeight.w600),
            ),
          ],
          if (onReview != null) ...[
            const SizedBox(height: MorganSpace.md),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(onPressed: onReview, child: const Text('Review action')),
            ),
          ],
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
  });

  final String headline;
  final String narrative;
  final String? dateLabel;
  final bool isEmpty;
  final String? emptyMessage;
  final bool expandAll;

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
    final showReadMore = !widget.isEmpty &&
        !widget.expandAll &&
        !_expanded &&
        _isTruncated(widget.narrative);
    final visibleNarrative = widget.isEmpty
        ? (widget.emptyMessage ?? widget.narrative)
        : (_expanded || !showReadMore ? widget.narrative : _preview(widget.narrative));

    return MorganSurface(
      child: Column(
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
          const SizedBox(height: MorganSpace.md),
          Text(
            widget.headline,
            style: theme.textTheme.titleLarge?.copyWith(height: 1.3),
          ),
          if (visibleNarrative.isNotEmpty) ...[
            const SizedBox(height: MorganSpace.sm),
            Text(visibleNarrative, style: theme.textTheme.bodyLarge),
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
          if (_expanded && _isTruncated(widget.narrative))
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
      ),
    );
  }

  bool _isTruncated(String narrative) {
    return narrative.trim().length > 180;
  }

  String _preview(String narrative) {
    const limit = 180;
    final trimmed = narrative.trim();
    if (trimmed.length <= limit) return trimmed;
    final cutoff = trimmed.lastIndexOf(' ', limit);
    final end = cutoff > 80 ? cutoff : limit;
    return '${trimmed.substring(0, end).trim()}…';
  }
}
