import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../alerts/alerts_providers.dart';
import '../brief/brief_formatters.dart';
import '../brief/brief_repository.dart';
import 'chat_models.dart';
import 'chat_repository.dart';

const _fallbackStarters = [
  ChatStarter(label: 'Why did profit drop?', message: 'Why did profit drop yesterday?'),
  ChatStarter(label: 'Cash runway?', message: 'What is my cash runway?'),
  ChatStarter(label: 'Pause ads?', message: 'Which campaigns should I pause?'),
];

final chatStartersProvider = FutureProvider<List<ChatStarter>>((ref) async {
  final brief = ref.watch(dailyBriefProvider).valueOrNull;
  ref.watch(alertsProvider);

  List<ChatStarter> briefStarters = [];
  final topAction = brief?.topAction;
  if (brief?.hasBrief == true && topAction != null) {
    briefStarters = [
      ChatStarter(
        label: 'Today\'s action',
        message: topActionChatPrompt(topAction),
      ),
    ];
  }

  try {
    final starters = await ref.read(chatRepositoryProvider).getStarters();
    return _mergeStarters([...briefStarters, ...starters]);
  } catch (_) {
    return _mergeStarters([...briefStarters, ..._fallbackStarters]);
  }
});

List<ChatStarter> _mergeStarters(List<ChatStarter> starters) {
  final merged = <ChatStarter>[];
  final seen = <String>{};

  for (final starter in starters) {
    final key = starter.message.trim().toLowerCase();
    if (seen.contains(key)) continue;
    seen.add(key);
    merged.add(starter);
    if (merged.length >= 5) break;
  }

  for (final fallback in _fallbackStarters) {
    if (merged.length >= 5) break;
    final key = fallback.message.trim().toLowerCase();
    if (seen.contains(key)) continue;
    seen.add(key);
    merged.add(fallback);
  }

  return merged;
}
