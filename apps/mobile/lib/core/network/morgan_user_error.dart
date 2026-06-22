import 'package:dio/dio.dart';

enum MorganErrorKind {
  network,
  client,
  server,
  unknown,
}

/// Merchant-safe error copy with network / HTTP classification (US-UX-15-03).
class MorganUserError {
  const MorganUserError({
    required this.message,
    required this.kind,
  });

  final String message;
  final MorganErrorKind kind;

  factory MorganUserError.from(
    Object? error, {
    String? fallback,
  }) {
    if (error is DioException) {
      final kind = _kindFromDio(error);
      return MorganUserError(
        message: _messageForDio(error, kind, fallback: fallback),
        kind: kind,
      );
    }

    return MorganUserError(
      message: fallback ?? 'Something went wrong. Try again.',
      kind: MorganErrorKind.unknown,
    );
  }

  static MorganErrorKind _kindFromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return MorganErrorKind.network;
      case DioExceptionType.badResponse:
        final code = error.response?.statusCode ?? 0;
        if (code >= 500) return MorganErrorKind.server;
        if (code >= 400) return MorganErrorKind.client;
        return MorganErrorKind.unknown;
      default:
        return MorganErrorKind.unknown;
    }
  }

  static String _messageForDio(
    DioException error,
    MorganErrorKind kind, {
    String? fallback,
  }) {
    return switch (kind) {
      MorganErrorKind.network => 'Check your connection and try again.',
      MorganErrorKind.client => _clientMessage(error.response?.statusCode, fallback),
      MorganErrorKind.server => 'Morgan is having trouble on our side. Try again shortly.',
      MorganErrorKind.unknown => fallback ?? 'Something went wrong. Try again.',
    };
  }

  static String _clientMessage(int? statusCode, String? fallback) {
    return switch (statusCode) {
      401 || 403 => 'Session expired. Sign in again to continue.',
      404 => 'This item is no longer available.',
      _ => fallback ?? 'We could not load this right now.',
    };
  }
}
