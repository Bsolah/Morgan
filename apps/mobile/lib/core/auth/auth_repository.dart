import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'auth_session.dart';

const _accessTokenKey = 'morgan_access_token';
const _refreshTokenKey = 'morgan_refresh_token';
const _storeIdKey = 'morgan_store_id';
const _shopDomainKey = 'morgan_shop_domain';

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

  /// Localhost-only dev session — no real Shopify tokens.
  Future<AuthSession> seedDevSession() async {
    const session = AuthSession(
      accessToken: 'dev-local-access-token',
      refreshToken: 'dev-local-refresh-token',
      storeId: AppConfig.devSessionStoreId,
      shopDomain: AppConfig.devSessionShopDomain,
    );
    await _persist(session);
    return session;
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
    ]);
  }
}
