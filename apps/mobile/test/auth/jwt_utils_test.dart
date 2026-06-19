import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:morgan_mobile/core/auth/jwt_utils.dart';

void main() {
  group('jwt_utils', () {
    test('detects expired access token with skew', () {
      final past = DateTime.now().toUtc().subtract(const Duration(minutes: 5));
      final token = _makeToken(past.millisecondsSinceEpoch ~/ 1000);
      expect(isAccessTokenExpired(token), isTrue);
    });

    test('accepts valid access token', () {
      final future = DateTime.now().toUtc().add(const Duration(minutes: 10));
      final token = _makeToken(future.millisecondsSinceEpoch ~/ 1000);
      expect(isAccessTokenExpired(token), isFalse);
    });
  });
}

String _makeToken(int expSeconds) {
  final payload = '{"exp":$expSeconds}';
  final encoded = base64Url.encode(utf8.encode(payload)).replaceAll('=', '');
  return 'header.$encoded.sig';
}
