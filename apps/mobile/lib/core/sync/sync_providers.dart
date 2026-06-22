import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';
import '../auth/auth_session.dart';
import '../config/app_config.dart';
import 'sync_status.dart';

class SyncRepository {
  SyncRepository(this._session);

  final AuthSession _session;

  Dio get _dio => Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          headers: {'Authorization': 'Bearer ${_session.accessToken}'},
        ),
      );

  Future<SyncStatus> fetchStatus() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/sync/status',
    );
    return SyncStatus.fromJson(response.data!);
  }
}

final syncStatusProvider = StreamProvider<SyncStatus>((ref) async* {
  final session = await ref.watch(authSessionProvider.future);
  if (session == null) return;

  final repo = SyncRepository(session);

  while (true) {
    try {
      yield await repo.fetchStatus();
    } catch (_) {
      // Fall back to zero progress when API unavailable (local dev without DB).
      yield SyncStatus(
        storeId: session.storeId,
        overallPercent: 0,
        etaMinutes: 4,
        storeStatus: 'syncing',
        tasks: const [
          SyncTaskProgress(id: 'orders', label: 'Orders', percent: 0, status: SyncTaskStatus.pending),
          SyncTaskProgress(id: 'products', label: 'Products', percent: 0, status: SyncTaskStatus.pending),
          SyncTaskProgress(
            id: 'inventory',
            label: 'Inventory',
            percent: 0,
            status: SyncTaskStatus.pending,
          ),
        ],
      );
    }
    await Future<void>.delayed(const Duration(seconds: 2));
  }
});
