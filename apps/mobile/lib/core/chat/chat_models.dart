import 'package:intl/intl.dart';

class ChatCitation {
  const ChatCitation({
    required this.source,
    required this.date,
    this.metric,
    this.sourceLabel,
    this.querySummary,
    this.rawValues = const {},
    this.dataAsOf,
    this.isStale = false,
  });

  final String source;
  final String date;
  final String? metric;
  final String? sourceLabel;
  final String? querySummary;
  final Map<String, dynamic> rawValues;
  final String? dataAsOf;
  final bool isStale;

  String get displaySource {
    if (sourceLabel != null && sourceLabel!.isNotEmpty) return sourceLabel!;
    return source.replaceFirst(RegExp(r'^mart_'), '');
  }

  String get displayDate {
    final parsed = DateTime.tryParse('${date}T12:00:00Z');
    if (parsed == null) return date;
    return DateFormat('MMM d').format(parsed.toUtc());
  }

  bool get isStaleNow {
    if (isStale) return true;
    final anchor = dataAsOf ?? '${date}T23:59:59.000Z';
    final parsed = DateTime.tryParse(anchor);
    if (parsed == null) return false;
    return DateTime.now().difference(parsed.toLocal()) > const Duration(hours: 48);
  }

  factory ChatCitation.fromJson(Map<String, dynamic> json) {
    final rawValuesJson = json['raw_values'] as Map<String, dynamic>? ?? const {};
    return ChatCitation(
      source: json['source'] as String? ?? json['source_table'] as String? ?? '',
      date: json['date'] as String? ?? json['source_date'] as String? ?? '',
      metric: json['metric'] as String?,
      sourceLabel: json['source_label'] as String?,
      querySummary: json['query_summary'] as String?,
      rawValues: Map<String, dynamic>.from(rawValuesJson),
      dataAsOf: json['data_as_of'] as String?,
      isStale: json['is_stale'] as bool? ?? false,
    );
  }
}

class ChatActionCard {
  const ChatActionCard({
    required this.recommendationId,
    required this.title,
    required this.body,
    required this.category,
    this.impactLabel,
    this.status = 'open',
  });

  final String recommendationId;
  final String title;
  final String body;
  final String category;
  final String? impactLabel;
  final String status;

  bool get isOpen => status == 'open';

  ChatActionCard copyWith({String? status}) {
    return ChatActionCard(
      recommendationId: recommendationId,
      title: title,
      body: body,
      category: category,
      impactLabel: impactLabel,
      status: status ?? this.status,
    );
  }

  factory ChatActionCard.fromJson(Map<String, dynamic> json) {
    return ChatActionCard(
      recommendationId: json['recommendation_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      category: json['category'] as String? ?? '',
      impactLabel: json['impact_label'] as String?,
      status: json['status'] as String? ?? 'open',
    );
  }
}

class ChatScenarioForecast {
  const ChatScenarioForecast({
    required this.profitChangeLowUsd,
    required this.profitChangeHighUsd,
    required this.cashImpactLowUsd,
    required this.cashImpactHighUsd,
    required this.confidence,
    required this.confidenceBandPct,
    required this.assumptions,
  });

  final int profitChangeLowUsd;
  final int profitChangeHighUsd;
  final int cashImpactLowUsd;
  final int cashImpactHighUsd;
  final String confidence;
  final int confidenceBandPct;
  final List<String> assumptions;

  factory ChatScenarioForecast.fromJson(Map<String, dynamic> json) {
    return ChatScenarioForecast(
      profitChangeLowUsd: (json['profit_change_low_usd'] as num?)?.round() ?? 0,
      profitChangeHighUsd: (json['profit_change_high_usd'] as num?)?.round() ?? 0,
      cashImpactLowUsd: (json['cash_impact_low_usd'] as num?)?.round() ?? 0,
      cashImpactHighUsd: (json['cash_impact_high_usd'] as num?)?.round() ?? 0,
      confidence: json['confidence'] as String? ?? 'medium',
      confidenceBandPct: (json['confidence_band_pct'] as num?)?.round() ?? 20,
      assumptions: (json['assumptions'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
    );
  }
}

class ChatScenarioCard {
  const ChatScenarioCard({
    required this.title,
    required this.forecast,
    required this.savePayload,
    this.saved = false,
    this.scenarioId,
  });

  final String title;
  final ChatScenarioForecast forecast;
  final Map<String, dynamic> savePayload;
  final bool saved;
  final String? scenarioId;

  ChatScenarioCard copyWith({bool? saved, String? scenarioId}) {
    return ChatScenarioCard(
      title: title,
      forecast: forecast,
      savePayload: savePayload,
      saved: saved ?? this.saved,
      scenarioId: scenarioId ?? this.scenarioId,
    );
  }

  factory ChatScenarioCard.fromJson(Map<String, dynamic> json) {
    return ChatScenarioCard(
      title: json['title'] as String? ?? '',
      forecast: ChatScenarioForecast.fromJson(json['forecast'] as Map<String, dynamic>? ?? const {}),
      savePayload: Map<String, dynamic>.from(json['save_payload'] as Map<String, dynamic>? ?? const {}),
      saved: json['saved'] as bool? ?? false,
      scenarioId: json['scenario_id'] as String?,
    );
  }
}

class ChatStarter {
  const ChatStarter({
    required this.label,
    required this.message,
    this.source,
  });

  final String label;
  final String message;
  final String? source;

  factory ChatStarter.fromJson(Map<String, dynamic> json) {
    return ChatStarter(
      label: json['label'] as String? ?? '',
      message: json['message'] as String? ?? '',
      source: json['source'] as String? ?? '',
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.citations = const [],
    this.confidence,
    this.followUps = const [],
    this.actionCard,
    this.scenarioCard,
    this.isStreaming = false,
  });

  final String id;
  final String role;
  final String content;
  final List<ChatCitation> citations;
  final String? confidence;
  final List<String> followUps;
  final ChatActionCard? actionCard;
  final ChatScenarioCard? scenarioCard;
  final bool isStreaming;

  bool get isAssistant => role == 'assistant';

  ChatMessage copyWith({
    String? id,
    String? role,
    String? content,
    List<ChatCitation>? citations,
    String? confidence,
    List<String>? followUps,
    ChatActionCard? actionCard,
    ChatScenarioCard? scenarioCard,
    bool? isStreaming,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      role: role ?? this.role,
      content: content ?? this.content,
      citations: citations ?? this.citations,
      confidence: confidence ?? this.confidence,
      followUps: followUps ?? this.followUps,
      actionCard: actionCard ?? this.actionCard,
      scenarioCard: scenarioCard ?? this.scenarioCard,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final citationsJson = json['citations'] as List<dynamic>? ?? const [];
    final actionCardJson = json['action_card'] as Map<String, dynamic>?;
    final scenarioCardJson = json['scenario_card'] as Map<String, dynamic>?;
    return ChatMessage(
      id: json['id'] as String? ?? '',
      role: json['role'] as String? ?? 'user',
      content: json['content'] as String? ?? '',
      citations: citationsJson
          .whereType<Map<String, dynamic>>()
          .map(ChatCitation.fromJson)
          .toList(),
      confidence: json['confidence'] as String?,
      followUps: (json['follow_ups'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      actionCard: actionCardJson == null ? null : ChatActionCard.fromJson(actionCardJson),
      scenarioCard: scenarioCardJson == null ? null : ChatScenarioCard.fromJson(scenarioCardJson),
    );
  }
}

class ChatStreamEvent {
  const ChatStreamEvent.meta({
    required this.confidence,
    required this.followUps,
  })  : type = ChatStreamEventType.meta,
        text = null,
        citation = null,
        actionCard = null,
        scenarioCard = null,
        messageId = null;

  const ChatStreamEvent.token({required this.text})
      : type = ChatStreamEventType.token,
        confidence = null,
        followUps = const [],
        citation = null,
        actionCard = null,
        scenarioCard = null,
        messageId = null;

  const ChatStreamEvent.citation({required this.citation})
      : type = ChatStreamEventType.citation,
        confidence = null,
        followUps = const [],
        text = null,
        actionCard = null,
        scenarioCard = null,
        messageId = null;

  const ChatStreamEvent.action({required this.actionCard})
      : type = ChatStreamEventType.action,
        confidence = null,
        followUps = const [],
        text = null,
        citation = null,
        scenarioCard = null,
        messageId = null;

  const ChatStreamEvent.scenario({required this.scenarioCard})
      : type = ChatStreamEventType.scenario,
        confidence = null,
        followUps = const [],
        text = null,
        citation = null,
        actionCard = null,
        messageId = null;

  const ChatStreamEvent.done({required this.messageId})
      : type = ChatStreamEventType.done,
        confidence = null,
        followUps = const [],
        text = null,
        citation = null,
        actionCard = null,
        scenarioCard = null;

  final ChatStreamEventType type;
  final String? text;
  final ChatCitation? citation;
  final ChatActionCard? actionCard;
  final ChatScenarioCard? scenarioCard;
  final String? confidence;
  final List<String> followUps;
  final String? messageId;
}

enum ChatStreamEventType { meta, token, citation, action, scenario, done }
