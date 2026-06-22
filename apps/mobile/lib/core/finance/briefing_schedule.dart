import 'package:flutter/material.dart';

class BriefingSchedulePending {
  const BriefingSchedulePending({
    this.timezone,
    this.briefingTimeLocal,
    required this.effectiveFrom,
  });

  final String? timezone;
  final String? briefingTimeLocal;
  final String effectiveFrom;

  factory BriefingSchedulePending.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      throw ArgumentError('pending schedule json required');
    }
    return BriefingSchedulePending(
      timezone: json['timezone'] as String?,
      briefingTimeLocal: json['briefing_time_local'] as String?,
      effectiveFrom: json['effective_from'] as String,
    );
  }
}

class BriefingSchedule {
  const BriefingSchedule({
    required this.timezone,
    required this.briefingTimeLocal,
    required this.shopifyTimezone,
    required this.timezoneOverridden,
    required this.nextBriefingAt,
    this.pending,
    this.timezoneOptions = const [],
  });

  final String timezone;
  final String briefingTimeLocal;
  final String shopifyTimezone;
  final bool timezoneOverridden;
  final String nextBriefingAt;
  final BriefingSchedulePending? pending;
  final List<String> timezoneOptions;

  factory BriefingSchedule.fromJson(Map<String, dynamic> json) {
    final pendingJson = json['pending'] as Map<String, dynamic>?;
    return BriefingSchedule(
      timezone: json['timezone'] as String? ?? 'UTC',
      briefingTimeLocal: json['briefing_time_local'] as String? ?? '06:00',
      shopifyTimezone: json['shopify_timezone'] as String? ?? 'UTC',
      timezoneOverridden: json['timezone_overridden'] as bool? ?? false,
      nextBriefingAt: json['next_briefing_at'] as String? ?? '',
      pending: pendingJson == null ? null : BriefingSchedulePending.fromJson(pendingJson),
      timezoneOptions: (json['timezone_options'] as List<dynamic>? ?? [])
          .map((item) => item as String)
          .toList(),
    );
  }

  String get settingsSubtitle => formatBriefingTimeLocal(briefingTimeLocal);
}

class UpdateBriefingScheduleRequest {
  const UpdateBriefingScheduleRequest({
    this.timezone,
    this.briefingTimeLocal,
  });

  final String? timezone;
  final String? briefingTimeLocal;

  Map<String, dynamic> toJson() => {
        if (timezone != null) 'timezone': timezone,
        if (briefingTimeLocal != null) 'briefing_time_local': briefingTimeLocal,
      };
}

String formatBriefingTimeLocal(String value) {
  final parts = value.split(':');
  if (parts.length != 2) return value;
  final hour = int.tryParse(parts[0]) ?? 6;
  final minute = int.tryParse(parts[1]) ?? 0;
  final period = hour >= 12 ? 'PM' : 'AM';
  final hour12 = hour % 12 == 0 ? 12 : hour % 12;
  if (minute == 0) {
    return '$hour12:00 $period';
  }
  return '$hour12:${minute.toString().padLeft(2, '0')} $period';
}

String formatBriefingTimeOfDay(TimeOfDay time) {
  return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
}

TimeOfDay parseBriefingTimeOfDay(String value) {
  final parts = value.split(':');
  if (parts.length != 2) return const TimeOfDay(hour: 6, minute: 0);
  return TimeOfDay(hour: int.tryParse(parts[0]) ?? 6, minute: int.tryParse(parts[1]) ?? 0);
}

String formatTimezoneLabel(String timezone) => timezone.replaceAll('_', ' ');
