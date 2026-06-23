import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_exception.dart';
import '../auth/auth_providers.dart';
import '../config/app_config.dart';

typedef ReauthCallback = void Function(String? returnTo);

class ApiClient {
  ApiClient({
    required AuthRepository authRepository,
    ReauthCallback? onReauthRequired,
  })  : _authRepository = authRepository,
        _onReauthRequired = onReauthRequired {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError: _onError,
      ),
    );
  }

  final AuthRepository _authRepository;
  final ReauthCallback? _onReauthRequired;
  late final Dio _dio;

  Dio get dio => _dio;

  bool _refreshInFlight = false;
  Future<String?>? _refreshFuture;

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['skipAuth'] == true) {
      return handler.next(options);
    }

    try {
      final token = await _authRepository.getValidAccessToken();
      options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    } on AuthException catch (e) {
      if (e.code == 'refresh_expired' || e.code == 'not_signed_in') {
        _onReauthRequired?.call(options.extra['returnTo'] as String?);
      }
      handler.reject(
        DioException(
          requestOptions: options,
          type: DioExceptionType.cancel,
          error: e,
        ),
      );
    } on DioException catch (e) {
      if (AppConfig.canSkipSetup) {
        final session = await _authRepository.loadSession();
        if (session != null) {
          options.headers['Authorization'] = 'Bearer ${session.accessToken}';
          return handler.next(options);
        }
      }
      handler.reject(e);
    }
  }

  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;
    final options = err.requestOptions;

    if (response?.statusCode != 401 || options.extra['skipAuth'] == true) {
      return handler.next(err);
    }

    if (options.extra['retried'] == true) {
      final returnTo = options.extra['returnTo'] as String?;
      await _authRepository.savePendingRoute(returnTo);
      _onReauthRequired?.call(returnTo);
      return handler.reject(
        DioException(
          requestOptions: options,
          response: response,
          type: DioExceptionType.badResponse,
          error: ReauthRequiredException(returnTo: returnTo),
        ),
      );
    }

    try {
      final token = await _refreshTokenOnce();
      if (token == null) {
        final returnTo = options.extra['returnTo'] as String?;
        await _authRepository.savePendingRoute(returnTo);
        _onReauthRequired?.call(returnTo);
        return handler.reject(
          DioException(
            requestOptions: options,
            response: response,
            type: DioExceptionType.badResponse,
            error: ReauthRequiredException(returnTo: returnTo),
          ),
        );
      }

      options.headers['Authorization'] = 'Bearer $token';
      options.extra['retried'] = true;

      final retryResponse = await _dio.fetch(options);
      handler.resolve(retryResponse);
    } catch (_) {
      final returnTo = options.extra['returnTo'] as String?;
      await _authRepository.savePendingRoute(returnTo);
      _onReauthRequired?.call(returnTo);
      handler.reject(err);
    }
  }

  Future<String?> _refreshTokenOnce() async {
    if (_refreshInFlight) {
      return _refreshFuture;
    }

    _refreshInFlight = true;
    _refreshFuture = _authRepository.refreshAccessToken().then((s) => s.accessToken).catchError((_) => null);

    try {
      return await _refreshFuture;
    } finally {
      _refreshInFlight = false;
      _refreshFuture = null;
    }
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final authRepository = ref.watch(authRepositoryProvider);

  return ApiClient(
    authRepository: authRepository,
    onReauthRequired: (returnTo) {
      ref.read(authControllerProvider.notifier).requireReauth(returnTo: returnTo);
    },
  );
});
