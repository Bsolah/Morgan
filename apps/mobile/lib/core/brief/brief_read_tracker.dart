import 'package:shared_preferences/shared_preferences.dart';

/// Tracks which briefing dates the user has opened (for history unread badges).
class BriefReadTracker {
  BriefReadTracker(this._prefs);

  static const _keyPrefix = 'brief_read_';

  final SharedPreferences _prefs;

  static Future<BriefReadTracker> create() async {
    return BriefReadTracker(await SharedPreferences.getInstance());
  }

  bool isRead(String storeId, String date) {
    return _prefs.getBool('$_keyPrefix${storeId}_$date') ?? false;
  }

  Future<void> markRead(String storeId, String date) async {
    await _prefs.setBool('$_keyPrefix${storeId}_$date', true);
  }
}
