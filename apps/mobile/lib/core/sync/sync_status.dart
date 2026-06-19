class SyncStatus {
  const SyncStatus({
    required this.storeId,
    required this.status,
    required this.label,
    required this.processedCount,
    this.totalCount,
    this.progressPercent,
    required this.partialBriefAvailable,
    required this.partialBriefThreshold,
    this.error,
  });

  final String storeId;
  final String status;
  final String label;
  final int processedCount;
  final int? totalCount;
  final double? progressPercent;
  final bool partialBriefAvailable;
  final double partialBriefThreshold;
  final String? error;

  bool get isComplete => status == 'completed';
  bool get isActive => status == 'pending' || status == 'bulk_running' || status == 'processing';
  bool get showPartialBrief => partialBriefAvailable;

  factory SyncStatus.fromJson(Map<String, dynamic> json) {
    return SyncStatus(
      storeId: json['store_id'] as String,
      status: json['status'] as String,
      label: json['label'] as String,
      processedCount: (json['processed_count'] as num?)?.toInt() ?? 0,
      totalCount: (json['total_count'] as num?)?.toInt(),
      progressPercent: (json['progress_percent'] as num?)?.toDouble(),
      partialBriefAvailable: json['partial_brief_available'] as bool? ?? false,
      partialBriefThreshold: (json['partial_brief_threshold'] as num?)?.toDouble() ?? 0.5,
      error: json['error'] as String?,
    );
  }
}
