import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../alerts/alerts_providers.dart';
import '../brief/brief_repository.dart';
import 'chat_models.dart';
import 'chat_repository.dart';

const _fallbackStarters = [
  ChatStarter(label: 'Why did profit drop?', message: 'Why did profit drop yesterday?'),
  ChatStarter(label: 'Cash runway?', message: 'What is my cash runway?'),
  ChatStarter(label: 'Pause ads?', message: 'Which campaigns should I pause?'),
];

final chatStartersProvider = FutureProvider<List<ChatStarter>>((ref) async {
  ref.watch(dailyBriefProvider);
  ref.watch(alertsProvider);

  try {
    final starters = await ref.read(chatRepositoryProvider).getStarters();
    if (starters.length >= 3) return starters;
    return _mergeWithFallback(starters);
  } catch (_) {
    return _fallbackStarters;
  }
});

List<ChatStarter> _mergeWithFallback(List<ChatStarter> starters) {
  final merged = [...starters];
  final seen = merged.map((starter) => starter.message.trim().toLowerCase()).toSet();

  for (final fallback in _fallbackStarters) {
    if (merged.length >= 3) break;
    final key = fallback.message.trim().toLowerCase();
    if (seen.contains(key)) continue;
    seen.add(key);
    merged.add(fallback);
  }

  return merged;
}
