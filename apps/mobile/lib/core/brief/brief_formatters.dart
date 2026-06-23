import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import 'brief_repository.dart';
import '../../shared/widgets/morgan_metric_card.dart';
import '../metrics/metrics_repository.dart';

/// Loss-related spans in briefing narrative (negative amounts, %, keywords).
final List<RegExp> _briefLossPatterns = [
  RegExp(r'-\$[\d,]+(?:\.\d{2})?'),
  RegExp(r'-\d+(?:\.\d+)?%'),
  RegExp(r'\$[\d,]+(?:\.\d{2})?\s+(?:loss|decline)', caseSensitive: false),
  RegExp(r'(?:lost|losing)\s+\$[\d,]+(?:\.\d{2})?', caseSensitive: false),
  RegExp(r'below target', caseSensitive: false),
  RegExp(r'\b(?:unprofitable|underwater)\b', caseSensitive: false),
];

List<({int start, int end})> findBriefLossHighlights(String text) {
  final matches = <({int start, int end})>[];
  for (final pattern in _briefLossPatterns) {
    for (final match in pattern.allMatches(text)) {
      matches.add((start: match.start, end: match.end));
    }
  }
  if (matches.isEmpty) return matches;

  matches.sort((a, b) => a.start.compareTo(b.start));
  final merged = <({int start, int end})>[matches.first];
  for (var i = 1; i < matches.length; i++) {
    final current = matches[i];
    final last = merged.last;
    if (current.start <= last.end) {
      merged[merged.length - 1] = (
        start: last.start,
        end: current.end > last.end ? current.end : last.end,
      );
    } else {
      merged.add(current);
    }
  }
  return merged;
}

List<InlineSpan> buildBriefNarrativeSpans({
  required String text,
  required TextStyle baseStyle,
  required Color lossColor,
}) {
  final highlights = findBriefLossHighlights(text);
  if (highlights.isEmpty) {
    return [TextSpan(text: text, style: baseStyle)];
  }

  final spans = <InlineSpan>[];
  var cursor = 0;
  for (final highlight in highlights) {
    if (highlight.start > cursor) {
      spans.add(TextSpan(text: text.substring(cursor, highlight.start), style: baseStyle));
    }
    spans.add(
      TextSpan(
        text: text.substring(highlight.start, highlight.end),
        style: baseStyle.copyWith(
          color: lossColor,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
    cursor = highlight.end;
  }
  if (cursor < text.length) {
    spans.add(TextSpan(text: text.substring(cursor), style: baseStyle));
  }
  return spans;
}

BriefingKpiDelta? findKpiDelta(DailyBrief brief, String key) {
  for (final delta in brief.kpiDeltas) {
    if (delta.key == key) return delta;
  }
  return null;
}

String formatKpiValue(BriefingKpiDelta delta) {
  switch (delta.format) {
    case 'currency':
      return formatMetricCurrency(delta.value);
    case 'percent':
      return formatMerRatio(delta.value);
    case 'ratio':
      return formatMetricRatio(delta.value);
    case 'count':
      return delta.value.toStringAsFixed(0);
    default:
      return delta.value.toStringAsFixed(2);
  }
}

String? formatKpiDelta(BriefingKpiDelta? delta) {
  if (delta == null) return null;
  if (delta.direction == 'flat') return 'Flat vs prior week';
  final sign = delta.deltaPct >= 0 ? '+' : '';
  return '$sign${delta.deltaPct.toStringAsFixed(1)}% vs prior week';
}

MetricTrend? kpiTrend(BriefingKpiDelta? delta, {required bool higherIsBetter}) {
  if (delta == null || delta.direction == 'flat') return MetricTrend.neutral;

  final isUp = delta.direction == 'up';
  final isPositive = higherIsBetter ? isUp : !isUp;
  return isPositive ? MetricTrend.up : MetricTrend.down;
}

String formatBriefingDateLabel(DailyBrief brief) {
  if (brief.date.isEmpty) return 'Today';
  final parsed = DateTime.tryParse(brief.date);
  if (parsed == null) return brief.date;
  return DateFormat('EEEE, MMM d').format(parsed);
}

String formatNextBriefingDateTime(DailyBrief brief) {
  final nextAt = DateTime.tryParse(brief.nextBriefingAt);
  if (nextAt == null) return 'soon';
  return DateFormat('EEE, MMM d · h:mm a').format(nextAt.toLocal());
}

String formatImpactRange(BriefingTopAction action) {
  final low = action.impactLowUsd;
  final high = action.impactHighUsd;
  if (low == null && high == null) return '';
  final value = high ?? low ?? 0;
  return 'Protect ~${formatMetricCurrency(value)}';
}

String formatImpactAtRisk(BriefingTopAction action) {
  final low = action.impactLowUsd;
  final high = action.impactHighUsd;
  if (low == null && high == null) return '';
  final value = high ?? low ?? 0;
  return '~${formatMetricCurrency(value)} at risk';
}

String? topActionRoute(BriefingTopAction action) {
  switch (action.category) {
    case 'ad_waste':
    case 'marketing':
      return '/marketing';
    case 'setup':
      return '/settings';
    case 'dead_stock':
      return '/inventory';
    case 'return_drain':
    case 'discount_bleed':
      return '/profit';
    default:
      final key = action.externalKey?.trim();
      if (key != null && key.isNotEmpty) return '/recommendations/$key';
      return null;
  }
}

String topActionChatPrompt(BriefingTopAction action) {
  return 'Help me with this recommended action: ${action.title}. ${action.body}';
}

const int briefHeadlineHomeMaxLines = 2;
const int briefNarrativeHomeMaxLines = 3;
const int briefNarrativePreviewChars = 180;

bool briefNarrativeExceedsMaxLines({
  required String text,
  required TextStyle style,
  required Color lossColor,
  required double maxWidth,
  required int maxLines,
}) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return false;

  final painter = TextPainter(
    text: TextSpan(
      style: style,
      children: buildBriefNarrativeSpans(
        text: trimmed,
        baseStyle: style,
        lossColor: lossColor,
      ),
    ),
    maxLines: maxLines,
    textDirection: TextDirection.ltr,
  )..layout(maxWidth: maxWidth);

  return painter.didExceedMaxLines;
}

String briefNarrativePreview(String narrative) {
  final trimmed = narrative.trim();
  if (trimmed.length <= briefNarrativePreviewChars) return trimmed;

  final cutoff = trimmed.lastIndexOf(' ', briefNarrativePreviewChars);
  final end = cutoff > 80 ? cutoff : briefNarrativePreviewChars;
  return '${trimmed.substring(0, end).trim()}…';
}

bool briefNarrativeIsTruncated(String narrative) {
  return narrative.trim().length > briefNarrativePreviewChars;
}
