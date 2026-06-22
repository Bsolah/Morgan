import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../network/api_client.dart';
import 'brief_cache.dart';

class DailyBriefMarketing {
  const DailyBriefMarketing({
    required this.poas,
    required this.roas,
    required this.adSpend7d,
    required this.poasTooltip,
    required this.roasTooltip,
  });

  final double? poas;
  final double? roas;
  final double adSpend7d;
  final String poasTooltip;
  final String roasTooltip;

  factory DailyBriefMarketing.fromJson(Map<String, dynamic> json) {
    return DailyBriefMarketing(
      poas: (json['poas'] as num?)?.toDouble(),
      roas: (json['roas'] as num?)?.toDouble(),
      adSpend7d: (json['ad_spend_7d'] as num?)?.toDouble() ?? 0,
      poasTooltip: json['tooltips']?['poas'] as String? ??
          'Profit on Ad Spend = attributed contribution margin divided by ad spend.',
      roasTooltip: json['tooltips']?['roas'] as String? ??
          'Return on Ad Spend = attributed revenue divided by ad spend.',
    );
  }

  Map<String, dynamic> toJson() => {
        'poas': poas,
        'roas': roas,
        'ad_spend_7d': adSpend7d,
        'tooltips': {
          'poas': poasTooltip,
          'roas': roasTooltip,
        },
      };
}

class BriefingKpiDelta {
  const BriefingKpiDelta({
    required this.key,
    required this.label,
    required this.value,
    required this.priorValue,
    required this.deltaPct,
    required this.direction,
    required this.format,
  });

  final String key;
  final String label;
  final double value;
  final double priorValue;
  final double deltaPct;
  final String direction;
  final String format;

  factory BriefingKpiDelta.fromJson(Map<String, dynamic> json) {
    return BriefingKpiDelta(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      value: (json['value'] as num?)?.toDouble() ?? 0,
      priorValue: (json['prior_value'] as num?)?.toDouble() ?? 0,
      deltaPct: (json['delta_pct'] as num?)?.toDouble() ?? 0,
      direction: json['direction'] as String? ?? 'flat',
      format: json['format'] as String? ?? 'currency',
    );
  }

  Map<String, dynamic> toJson() => {
        'key': key,
        'label': label,
        'value': value,
        'prior_value': priorValue,
        'delta_pct': deltaPct,
        'direction': direction,
        'format': format,
      };
}

class BriefingTopAction {
  const BriefingTopAction({
    required this.title,
    required this.body,
    required this.category,
    this.impactLowUsd,
    this.impactHighUsd,
    required this.source,
    this.externalKey,
  });

  final String title;
  final String body;
  final String category;
  final double? impactLowUsd;
  final double? impactHighUsd;
  final String source;
  final String? externalKey;

  factory BriefingTopAction.fromJson(Map<String, dynamic> json) {
    return BriefingTopAction(
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      category: json['category'] as String? ?? '',
      impactLowUsd: (json['impact_low_usd'] as num?)?.toDouble(),
      impactHighUsd: (json['impact_high_usd'] as num?)?.toDouble(),
      source: json['source'] as String? ?? 'fallback',
      externalKey: json['external_key'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title,
        'body': body,
        'category': category,
        'impact_low_usd': impactLowUsd,
        'impact_high_usd': impactHighUsd,
        'source': source,
        'external_key': externalKey,
      };
}

class DailyBrief {
  const DailyBrief({
    required this.date,
    required this.headline,
    required this.narrative,
    required this.metaConnected,
    required this.kpiDeltas,
    required this.hasBrief,
    required this.nextBriefingAt,
    required this.briefingTimeLocal,
    required this.timezone,
    this.version = 0,
    this.topAction,
    this.generatedAt,
    this.marketing,
  });

  final String date;
  final String headline;
  final String narrative;
  final bool metaConnected;
  final List<BriefingKpiDelta> kpiDeltas;
  final BriefingTopAction? topAction;
  final String? generatedAt;
  final DailyBriefMarketing? marketing;
  final bool hasBrief;
  final String nextBriefingAt;
  final String briefingTimeLocal;
  final String timezone;
  final int version;

  factory DailyBrief.fromJson(Map<String, dynamic> json) {
    final marketingJson = json['marketing'] as Map<String, dynamic>?;
    final kpiJson = json['kpi_deltas'] as List<dynamic>? ?? const [];
    final topActionJson = json['top_action'] as Map<String, dynamic>?;

    return DailyBrief(
      date: json['date'] as String? ?? '',
      headline: json['headline'] as String? ?? '',
      narrative: json['narrative'] as String? ?? '',
      metaConnected: json['meta_connected'] as bool? ?? false,
      kpiDeltas: kpiJson
          .whereType<Map<String, dynamic>>()
          .map(BriefingKpiDelta.fromJson)
          .toList(),
      topAction: topActionJson == null ? null : BriefingTopAction.fromJson(topActionJson),
      generatedAt: json['generated_at'] as String?,
      marketing: marketingJson == null ? null : DailyBriefMarketing.fromJson(marketingJson),
      hasBrief: json['has_brief'] as bool? ?? (json['generated_at'] != null),
      nextBriefingAt: json['next_briefing_at'] as String? ?? '',
      briefingTimeLocal: json['briefing_time_local'] as String? ?? '06:00',
      timezone: json['timezone'] as String? ?? 'UTC',
      version: json['version'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'date': date,
        'headline': headline,
        'narrative': narrative,
        'meta_connected': metaConnected,
        'kpi_deltas': kpiDeltas.map((item) => item.toJson()).toList(),
        'top_action': topAction?.toJson(),
        'generated_at': generatedAt,
        'marketing': marketing?.toJson(),
        'has_brief': hasBrief,
        'next_briefing_at': nextBriefingAt,
        'briefing_time_local': briefingTimeLocal,
        'timezone': timezone,
        'version': version,
      };
}

class BriefHistoryListItem {
  const BriefHistoryListItem({
    required this.date,
    required this.headline,
    required this.hasBrief,
    required this.version,
    this.generatedAt,
  });

  final String date;
  final String? headline;
  final bool hasBrief;
  final int version;
  final String? generatedAt;

  bool get hasSignificantDelta => version > 1;

  factory BriefHistoryListItem.fromJson(Map<String, dynamic> json) {
    return BriefHistoryListItem(
      date: json['date'] as String? ?? '',
      headline: json['headline'] as String?,
      hasBrief: json['has_brief'] as bool? ?? false,
      version: json['version'] as int? ?? 0,
      generatedAt: json['generated_at'] as String?,
    );
  }
}

class BriefHistoryList {
  const BriefHistoryList({
    required this.days,
    required this.items,
  });

  final int days;
  final List<BriefHistoryListItem> items;

  factory BriefHistoryList.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    return BriefHistoryList(
      days: json['days'] as int? ?? 30,
      items: itemsJson
          .whereType<Map<String, dynamic>>()
          .map(BriefHistoryListItem.fromJson)
          .toList(),
    );
  }
}

class BriefRepository {
  BriefRepository(this._dio);

  final Dio _dio;

  Future<DailyBrief> getTodayBrief() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/brief/today',
      options: Options(receiveTimeout: const Duration(seconds: 2)),
    );
    return DailyBrief.fromJson(response.data!);
  }

  Future<BriefHistoryList> getHistory({int days = 30}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/brief/history',
      queryParameters: {'days': days},
      options: Options(receiveTimeout: const Duration(seconds: 2)),
    );
    return BriefHistoryList.fromJson(response.data!);
  }

  Future<DailyBrief> getBriefForDate(String date) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/brief/$date',
      options: Options(receiveTimeout: const Duration(seconds: 2)),
    );
    return DailyBrief.fromJson(response.data!);
  }
}

final briefRepositoryProvider = Provider<BriefRepository>((ref) {
  return BriefRepository(ref.watch(apiClientProvider).dio);
});

class DailyBriefNotifier extends AsyncNotifier<DailyBrief> {
  @override
  Future<DailyBrief> build() async {
    final storeId = ref.watch(authControllerProvider).session?.storeId ?? '';
    if (storeId.isEmpty) {
      return _placeholderBrief();
    }

    final cache = ref.watch(briefLocalCacheProvider);
    final cached = cache.load(storeId);
    if (cached != null) {
      unawaited(_fetchAndUpdate(storeId, preserveOnError: true));
      return cached;
    }

    return _fetchAndUpdate(storeId);
  }

  /// Pull-to-refresh: keep cached brief visible while the network fetch runs.
  Future<void> refresh() async {
    final storeId = ref.read(authControllerProvider).session?.storeId ?? '';
    if (storeId.isEmpty) return;

    if (state.hasValue) {
      await _fetchAndUpdate(storeId, preserveOnError: true);
      return;
    }

    state = const AsyncLoading();
    state = AsyncData(await _fetchAndUpdate(storeId));
  }

  Future<DailyBrief> _fetchAndUpdate(String storeId, {bool preserveOnError = false}) async {
    try {
      final brief = await ref.read(briefRepositoryProvider).getTodayBrief();
      final cache = ref.read(briefLocalCacheProvider);
      await cache.save(storeId, brief);
      state = AsyncData(brief);
      return brief;
    } catch (error, stackTrace) {
      if (preserveOnError && state.hasValue) {
        return state.requireValue;
      }
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }

  DailyBrief _placeholderBrief() {
    return const DailyBrief(
      date: '',
      headline: '',
      narrative: '',
      metaConnected: false,
      kpiDeltas: [],
      hasBrief: false,
      nextBriefingAt: '',
      briefingTimeLocal: '06:00',
      timezone: 'UTC',
      version: 0,
    );
  }
}

final dailyBriefProvider = AsyncNotifierProvider<DailyBriefNotifier, DailyBrief>(
  DailyBriefNotifier.new,
);

class BriefHistoryListNotifier extends AsyncNotifier<BriefHistoryList> {
  @override
  Future<BriefHistoryList> build() async {
    final storeId = ref.watch(authControllerProvider).session?.storeId ?? '';
    if (storeId.isEmpty) {
      return const BriefHistoryList(days: 30, items: []);
    }

    try {
      final history = await ref.read(briefRepositoryProvider).getHistory();
      unawaited(_prefetchRecentBriefs(storeId, history));
      return history;
    } catch (_) {
      final cache = ref.read(briefLocalCacheProvider);
      final cachedBriefs = cache.loadHistoryBriefs(storeId);
      if (cachedBriefs.isEmpty) rethrow;
      return BriefHistoryList(
        days: 30,
        items: cachedBriefs
            .map(
              (brief) => BriefHistoryListItem(
                date: brief.date,
                headline: brief.headline,
                hasBrief: brief.hasBrief,
                version: brief.version,
                generatedAt: brief.generatedAt,
              ),
            )
            .toList(),
      );
    }
  }

  Future<void> _prefetchRecentBriefs(String storeId, BriefHistoryList history) async {
    final cache = ref.read(briefLocalCacheProvider);
    final repository = ref.read(briefRepositoryProvider);
    final dates = history.items.where((item) => item.hasBrief).take(BriefLocalCache.maxHistoryEntries);

    for (final item in dates) {
      if (cache.loadHistoryEntry(storeId, item.date) != null) continue;
      try {
        final brief = await repository.getBriefForDate(item.date);
        await cache.saveHistoryEntry(storeId, brief);
      } catch (_) {
        // Keep list usable even if individual prefetch fails.
      }
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await build());
  }
}

final briefHistoryListProvider = AsyncNotifierProvider<BriefHistoryListNotifier, BriefHistoryList>(
  BriefHistoryListNotifier.new,
);

final briefDetailProvider = FutureProvider.autoDispose.family<DailyBrief, String>((ref, date) async {
  final storeId = ref.watch(authControllerProvider).session?.storeId ?? '';
  if (storeId.isEmpty) {
    throw StateError('No store in session');
  }

  final cache = ref.watch(briefLocalCacheProvider);
  final cached = cache.loadHistoryEntry(storeId, date);

  try {
    final brief = await ref.watch(briefRepositoryProvider).getBriefForDate(date);
    await cache.saveHistoryEntry(storeId, brief);
    return brief;
  } catch (error) {
    if (cached != null) return cached;
    rethrow;
  }
});
