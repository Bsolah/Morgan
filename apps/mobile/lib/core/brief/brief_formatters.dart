import 'package:intl/intl.dart';

import 'brief_repository.dart';
import '../../shared/widgets/morgan_metric_card.dart';
import '../metrics/metrics_repository.dart';

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

const int briefNarrativePreviewChars = 180;

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
