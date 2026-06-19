import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import 'sync_status.dart';

class SyncRepository {
  SyncRepository(this._dio);

  final Dio _dio;

  Future<SyncStatus> getStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/sync/status');
    return SyncStatus.fromJson(response.data!);
  }
}

final syncRepositoryProvider = Provider<SyncRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return SyncRepository(apiClient.dio);
});

final syncStatusProvider = FutureProvider<SyncStatus>((ref) async {
  return ref.watch(syncRepositoryProvider).getStatus();
});
