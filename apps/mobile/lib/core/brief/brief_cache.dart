import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'brief_repository.dart';

class BriefLocalCache {
  BriefLocalCache(this._prefs);

  final SharedPreferences _prefs;

  static const _todayKeyPrefix = 'daily_brief_cache_v1';
  static const _historyKeyPrefix = 'brief_history_cache_v1';
  static const maxHistoryEntries = 7;

  String _todayKey(String storeId) => '$_todayKeyPrefix:$storeId';

  String _historyKey(String storeId) => '$_historyKeyPrefix:$storeId';

  DailyBrief? loadToday(String storeId) => load(storeId);

  DailyBrief? load(String storeId) {
    final raw = _prefs.getString(_todayKey(storeId));
    if (raw == null || raw.isEmpty) return null;

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return DailyBrief.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  DailyBrief? loadHistoryEntry(String storeId, String date) {
    final entries = _loadHistoryMap(storeId);
    final raw = entries[date];
    if (raw == null) return null;
    try {
      return DailyBrief.fromJson(raw);
    } catch (_) {
      return null;
    }
  }

  Map<String, Map<String, dynamic>> _loadHistoryMap(String storeId) {
    final raw = _prefs.getString(_historyKey(storeId));
    if (raw == null || raw.isEmpty) return {};

    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return decoded.map(
        (key, value) => MapEntry(key, Map<String, dynamic>.from(value as Map)),
      );
    } catch (_) {
      return {};
    }
  }

  List<DailyBrief> loadHistoryBriefs(String storeId) {
    final entries = _loadHistoryMap(storeId);
    final briefs = entries.values.map(DailyBrief.fromJson).toList()
      ..sort((left, right) => right.date.compareTo(left.date));
    return briefs;
  }

  Future<void> save(String storeId, DailyBrief brief) async {
    await _prefs.setString(_todayKey(storeId), jsonEncode(brief.toJson()));
    if (brief.hasBrief && brief.date.isNotEmpty) {
      await saveHistoryEntry(storeId, brief);
    }
  }

  Future<void> saveHistoryEntry(String storeId, DailyBrief brief) async {
    final entries = _loadHistoryMap(storeId);
    entries[brief.date] = brief.toJson();

    final sortedDates = entries.keys.toList()..sort((a, b) => b.compareTo(a));
    final trimmed = <String, Map<String, dynamic>>{};
    for (final date in sortedDates.take(maxHistoryEntries)) {
      trimmed[date] = entries[date]!;
    }

    await _prefs.setString(_historyKey(storeId), jsonEncode(trimmed));
  }

  Future<void> clear(String storeId) async {
    await _prefs.remove(_todayKey(storeId));
    await _prefs.remove(_historyKey(storeId));
  }
}

final briefLocalCacheProvider = FutureProvider<BriefLocalCache>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return BriefLocalCache(prefs);
});
