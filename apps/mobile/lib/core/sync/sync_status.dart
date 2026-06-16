enum SyncTaskStatus { pending, syncing, complete }

class SyncTaskProgress {
  const SyncTaskProgress({
    required this.id,
    required this.label,
    required this.percent,
    required this.status,
  });

  final String id;
  final String label;
  final int percent;
  final SyncTaskStatus status;

  factory SyncTaskProgress.fromJson(Map<String, dynamic> json) {
    return SyncTaskProgress(
      id: json['id'] as String,
      label: json['label'] as String,
      percent: json['percent'] as int,
      status: SyncTaskStatus.values.byName(json['status'] as String),
    );
  }
}

class SyncStatus {
  const SyncStatus({
    required this.storeId,
    required this.overallPercent,
    required this.etaMinutes,
    required this.tasks,
    required this.storeStatus,
  });

  final String storeId;
  final int overallPercent;
  final int? etaMinutes;
  final List<SyncTaskProgress> tasks;
  final String storeStatus;

  bool get isBriefReady => overallPercent >= 50;

  factory SyncStatus.fromJson(Map<String, dynamic> json) {
    final tasksJson = json['tasks'] as List<dynamic>;
    return SyncStatus(
      storeId: json['store_id'] as String,
      overallPercent: json['overall_percent'] as int,
      etaMinutes: json['eta_minutes'] as int?,
      tasks: tasksJson
          .map((task) => SyncTaskProgress.fromJson(task as Map<String, dynamic>))
          .toList(),
      storeStatus: json['store_status'] as String,
    );
  }
}
