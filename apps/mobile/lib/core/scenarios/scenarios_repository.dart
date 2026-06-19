import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

class SavedScenario {
  const SavedScenario({
    required this.id,
    required this.title,
    required this.scenarioType,
    this.channel,
    this.spendChangePct,
  });

  final String id;
  final String title;
  final String scenarioType;
  final String? channel;
  final double? spendChangePct;

  factory SavedScenario.fromJson(Map<String, dynamic> json) {
    return SavedScenario(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      scenarioType: json['scenario_type'] as String? ?? '',
      channel: json['channel'] as String?,
      spendChangePct: (json['spend_change_pct'] as num?)?.toDouble(),
    );
  }
}

class SaveScenarioResult {
  const SaveScenarioResult({required this.scenario});

  final SavedScenario scenario;

  factory SaveScenarioResult.fromJson(Map<String, dynamic> json) {
    return SaveScenarioResult(
      scenario: SavedScenario.fromJson(json['scenario'] as Map<String, dynamic>),
    );
  }
}

class ScenariosRepository {
  ScenariosRepository(this._dio);

  final Dio _dio;

  Future<List<SavedScenario>> listScenarios() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/scenarios');
    final items = response.data!['items'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map(SavedScenario.fromJson).toList();
  }

  Future<SavedScenario> saveScenario(Map<String, dynamic> payload) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/scenarios', data: payload);
    return SaveScenarioResult.fromJson(response.data!).scenario;
  }
}

final scenariosRepositoryProvider = Provider<ScenariosRepository>((ref) {
  return ScenariosRepository(ref.watch(apiClientProvider).dio);
});

final savedScenariosProvider = FutureProvider.autoDispose<List<SavedScenario>>((ref) {
  return ref.watch(scenariosRepositoryProvider).listScenarios();
});
