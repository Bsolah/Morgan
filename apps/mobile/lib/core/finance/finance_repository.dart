import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import 'finance_config.dart';
import 'briefing_schedule.dart';

class FinanceRepository {
  FinanceRepository(this._dio);

  final Dio _dio;

  Future<FinanceConfig> getConfig() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/finance/config');
    return FinanceConfig.fromJson(response.data!);
  }

  Future<FinanceConfig> updateConfig(UpdateFinanceConfigRequest request) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/finance/config',
      data: request.toJson(),
    );
    return FinanceConfig.fromJson(response.data!);
  }

  Future<FinanceConfig> updateTargetMargin(UpdateTargetMarginRequest request) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/finance/target-margin',
      data: request.toJson(),
    );
    return FinanceConfig.fromJson(response.data!);
  }

  Future<BriefingSchedule> getBriefingSchedule() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/finance/briefing-schedule');
    return BriefingSchedule.fromJson(response.data!);
  }

  Future<BriefingSchedule> updateBriefingSchedule(UpdateBriefingScheduleRequest request) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/finance/briefing-schedule',
      data: request.toJson(),
    );
    return BriefingSchedule.fromJson(response.data!);
  }
}

final financeRepositoryProvider = Provider<FinanceRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return FinanceRepository(apiClient.dio);
});

final financeConfigProvider = FutureProvider<FinanceConfig>((ref) async {
  final repo = ref.watch(financeRepositoryProvider);
  return repo.getConfig();
});

final briefingScheduleProvider = FutureProvider<BriefingSchedule>((ref) async {
  final repo = ref.watch(financeRepositoryProvider);
  return repo.getBriefingSchedule();
});
