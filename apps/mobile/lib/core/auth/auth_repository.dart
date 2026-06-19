import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'auth_exception.dart';
import 'auth_session.dart';
import 'jwt_utils.dart';

const _accessTokenKey = 'morgan_access_token';
const _refreshTokenKey = 'morgan_refresh_token';
const _storeIdKey = 'morgan_store_id';
const _shopDomainKey = 'morgan_shop_domain';
const _biometricEnabledKey = 'morgan_biometric_enabled';
const _pendingRouteKey = 'morgan_pending_route';

class AuthRepository {
  AuthRepository({
    Dio? dio,
    FlutterSecureStorage? storage,
  })  : _dio = dio ?? Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl)),
        _storage = storage ?? const FlutterSecureStorage();

  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<AuthSession?> loadSession() async {
    final accessToken = await _storage.read(key: _accessTokenKey);
    final refreshToken = await _storage.read(key: _refreshTokenKey);
    final storeId = await _storage.read(key: _storeIdKey);
    final shopDomain = await _storage.read(key: _shopDomainKey);

    if (accessToken == null || refreshToken == null || storeId == null || shopDomain == null) {
      return null;
    }

    return AuthSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      storeId: storeId,
      shopDomain: shopDomain,
    );
  }

  Future<AuthSession> exchangeConnectToken(String connectToken) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/shopify/token-exchange',
      data: {'connect_token': connectToken},
    );

    final data = response.data!;
    final session = AuthSession(
      accessToken: data['access_token'] as String,
      refreshToken: data['refresh_token'] as String,
      storeId: data['store_id'] as String,
      shopDomain: data['shop_domain'] as String,
    );

    await _persist(session);
    return session;
  }

  Future<String> getValidAccessToken() async {
    final session = await loadSession();
    if (session == null) {
      throw const AuthException('Not signed in', code: 'not_signed_in');
    }

    if (!isAccessTokenExpired(session.accessToken)) {
      return session.accessToken;
    }

    final refreshed = await refreshAccessToken();
    return refreshed.accessToken;
  }

  Future<AuthSession> refreshAccessToken() async {
    final refreshToken = await _storage.read(key: _refreshTokenKey);
    if (refreshToken == null) {
      throw const AuthException('No refresh token', code: 'no_refresh_token');
    }

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/v1/auth/refresh',
        data: {'refresh_token': refreshToken},
      );

      final accessToken = response.data!['access_token'] as String;
      final session = (await loadSession())!;

      final updated = AuthSession(
        accessToken: accessToken,
        refreshToken: session.refreshToken,
        storeId: session.storeId,
        shopDomain: session.shopDomain,
      );

      await _storage.write(key: _accessTokenKey, value: updated.accessToken);
      return updated;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw const AuthException('Refresh token expired', code: 'refresh_expired');
      }
      rethrow;
    }
  }

  Future<void> _persist(AuthSession session) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: session.accessToken),
      _storage.write(key: _refreshTokenKey, value: session.refreshToken),
      _storage.write(key: _storeIdKey, value: session.storeId),
      _storage.write(key: _shopDomainKey, value: session.shopDomain),
    ]);
  }

  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _storeIdKey),
      _storage.delete(key: _shopDomainKey),
      _storage.delete(key: _pendingRouteKey),
    ]);
  }

  Future<void> logout() async {
    await clearSession();
    await _storage.delete(key: _biometricEnabledKey);
  }

  Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: _biometricEnabledKey);
    return value == 'true';
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    if (enabled) {
      await _storage.write(key: _biometricEnabledKey, value: 'true');
    } else {
      await _storage.delete(key: _biometricEnabledKey);
    }
  }

  Future<void> savePendingRoute(String? route) async {
    if (route == null || route.isEmpty) {
      await _storage.delete(key: _pendingRouteKey);
      return;
    }
    await _storage.write(key: _pendingRouteKey, value: route);
  }

  Future<String?> loadPendingRoute() => _storage.read(key: _pendingRouteKey);

  Future<void> clearPendingRoute() => _storage.delete(key: _pendingRouteKey);
}

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());
