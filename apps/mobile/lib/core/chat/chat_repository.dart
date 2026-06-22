import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import 'chat_models.dart';

class ChatRepository {
  ChatRepository(this._dio);

  final Dio _dio;

  Future<String> createSession() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/chat/sessions');
    return response.data!['session_id'] as String;
  }

  Future<List<ChatStarter>> getStarters() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/chat/starters');
    final startersJson = response.data!['starters'] as List<dynamic>? ?? const [];
    return startersJson
        .whereType<Map<String, dynamic>>()
        .map(ChatStarter.fromJson)
        .where((starter) => starter.message.isNotEmpty)
        .toList();
  }

  Future<List<ChatMessage>> listMessages(String sessionId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/chat/sessions/$sessionId/messages',
    );
    final messagesJson = response.data!['messages'] as List<dynamic>? ?? const [];
    return messagesJson
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList();
  }

  Stream<ChatStreamEvent> sendMessageStream(String sessionId, String content) async* {
    final response = await _dio.post<ResponseBody>(
      '/api/v1/chat/sessions/$sessionId/messages',
      data: {'content': content},
      options: Options(
        responseType: ResponseType.stream,
        headers: {'Accept': 'text/event-stream'},
        receiveTimeout: const Duration(seconds: 60),
      ),
    );

    final stream = response.data?.stream;
    if (stream == null) return;

    var buffer = '';
    await for (final chunk in stream.cast<List<int>>().transform(utf8.decoder)) {
      buffer += chunk;
      final events = _drainSseBuffer(buffer);
      buffer = events.remaining;
      for (final event in events.parsed) {
        yield event;
      }
    }

    if (buffer.trim().isNotEmpty) {
      for (final event in _parseSseBlock(buffer)) {
        yield event;
      }
    }
  }
}

class _SseDrainResult {
  const _SseDrainResult({required this.parsed, required this.remaining});

  final List<ChatStreamEvent> parsed;
  final String remaining;
}

_SseDrainResult _drainSseBuffer(String buffer) {
  final parsed = <ChatStreamEvent>[];
  final blocks = buffer.split('\n\n');

  if (blocks.length <= 1) {
    return _SseDrainResult(parsed: parsed, remaining: buffer);
  }

  for (var i = 0; i < blocks.length - 1; i++) {
    parsed.addAll(_parseSseBlock(blocks[i]));
  }

  return _SseDrainResult(parsed: parsed, remaining: blocks.last);
}

List<ChatStreamEvent> _parseSseBlock(String block) {
  if (block.trim().isEmpty) return const [];

  String? eventName;
  final dataLines = <String>[];

  for (final line in block.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.add(line.substring(5).trim());
    }
  }

  if (eventName == null || dataLines.isEmpty) return const [];

  final payload = jsonDecode(dataLines.join('\n')) as Map<String, dynamic>;

  switch (eventName) {
    case 'meta':
      return [
        ChatStreamEvent.meta(
          confidence: payload['confidence'] as String? ?? 'medium',
          followUps: (payload['follow_ups'] as List<dynamic>? ?? const [])
              .whereType<String>()
              .toList(),
        ),
      ];
    case 'token':
      return [ChatStreamEvent.token(text: payload['text'] as String? ?? '')];
    case 'citation':
      return [
        ChatStreamEvent.citation(
          citation: ChatCitation.fromJson(payload),
        ),
      ];
    case 'action':
      return [
        ChatStreamEvent.action(
          actionCard: ChatActionCard.fromJson(payload),
        ),
      ];
    case 'scenario':
      return [
        ChatStreamEvent.scenario(
          scenarioCard: ChatScenarioCard.fromJson(payload),
        ),
      ];
    case 'done':
      return [
        ChatStreamEvent.done(messageId: payload['message_id'] as String? ?? ''),
      ];
    default:
      return const [];
  }
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepository(ref.watch(apiClientProvider).dio);
});
