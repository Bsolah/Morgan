class NotificationPrefs {
  const NotificationPrefs({
    required this.pushDailyBrief,
    required this.pushWarnings,
    required this.pushCritical,
    required this.quietHoursEnabled,
    required this.quietHoursStart,
    required this.quietHoursEnd,
    required this.weeklyEmailDigest,
  });

  final bool pushDailyBrief;
  final bool pushWarnings;
  final bool pushCritical;
  final bool quietHoursEnabled;
  final int quietHoursStart;
  final int quietHoursEnd;
  final bool weeklyEmailDigest;

  factory NotificationPrefs.fromJson(Map<String, dynamic> json) {
    return NotificationPrefs(
      pushDailyBrief: json['push_daily_brief'] as bool? ?? true,
      pushWarnings: json['push_warnings'] as bool? ?? true,
      pushCritical: json['push_critical'] as bool? ?? true,
      quietHoursEnabled: json['quiet_hours_enabled'] as bool? ?? true,
      quietHoursStart: json['quiet_hours_start'] as int? ?? 22,
      quietHoursEnd: json['quiet_hours_end'] as int? ?? 7,
      weeklyEmailDigest: json['weekly_email_digest'] as bool? ?? false,
    );
  }

  NotificationPrefs copyWith({
    bool? pushDailyBrief,
    bool? pushWarnings,
    bool? pushCritical,
    bool? quietHoursEnabled,
    int? quietHoursStart,
    int? quietHoursEnd,
    bool? weeklyEmailDigest,
  }) {
    return NotificationPrefs(
      pushDailyBrief: pushDailyBrief ?? this.pushDailyBrief,
      pushWarnings: pushWarnings ?? this.pushWarnings,
      pushCritical: pushCritical ?? this.pushCritical,
      quietHoursEnabled: quietHoursEnabled ?? this.quietHoursEnabled,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
      weeklyEmailDigest: weeklyEmailDigest ?? this.weeklyEmailDigest,
    );
  }

  Map<String, dynamic> toPatchJson(Map<String, dynamic> patch) => patch;

  String get quietHoursSummary =>
      '${formatHourLabel(quietHoursStart)} – ${formatHourLabel(quietHoursEnd)}';

  static String formatHourLabel(int hour) {
    final normalized = hour.clamp(0, 23);
    final period = normalized >= 12 ? 'PM' : 'AM';
    final display = normalized % 12 == 0 ? 12 : normalized % 12;
    return '$display:00 $period';
  }
}
