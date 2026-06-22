import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/chat/chat_models.dart';
import '../../../core/chat/chat_repository.dart';
import '../../../core/chat/chat_starters_provider.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/network_status_provider.dart';
import '../../../core/recommendations/recommendation_detail.dart';
import '../../../core/recommendations/recommendations_repository.dart';
import '../../../core/scenarios/scenarios_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_chip.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_offline_banner.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../../../shared/widgets/morgan_typing_indicator.dart';
import 'chat_citation_detail_sheet.dart';
import 'chat_inline_action_card.dart';
import 'chat_inline_scenario_card.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, this.initialPrompt});

  final String? initialPrompt;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  String? _sessionId;
  List<ChatMessage> _messages = [];
  bool _loadingSession = true;
  bool _sending = false;
  bool _initialPromptSent = false;
  String? _busyActionId;
  String? _busyScenarioSaveId;
  String? _retryContent;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initSession());
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initSession() async {
    try {
      final repository = ref.read(chatRepositoryProvider);
      final sessionId = await repository.createSession();
      final messages = await repository.listMessages(sessionId);
      if (!mounted) return;
      setState(() {
        _sessionId = sessionId;
        _messages = messages;
        _loadingSession = false;
      });
      ref.read(isOfflineProvider.notifier).state = false;
      _maybeSendInitialPrompt();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingSession = false;
        _error = 'Could not start chat session.';
      });
      if (_isConnectionError(error)) {
        ref.read(isOfflineProvider.notifier).state = true;
      }
    }
  }

  bool _isConnectionError(Object error) {
    if (error is DioException) {
      return error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout;
    }
    return false;
  }

  void _maybeSendInitialPrompt() {
    final prompt = widget.initialPrompt?.trim();
    if (prompt == null || prompt.isEmpty || _initialPromptSent || _sending) return;
    _initialPromptSent = true;
    _sendMessage(content: prompt);
  }

  void _sendStarter(String text) {
    _sendMessage(content: text);
  }

  Future<void> _sendMessage({String? content}) async {
    final messageContent = (content ?? _controller.text).trim();
    final sessionId = _sessionId;
    if (messageContent.isEmpty || sessionId == null || _sending) return;

    setState(() {
      _sending = true;
      _error = null;
      _retryContent = null;
      _messages = [
        ..._messages,
        ChatMessage(
          id: 'local-user-${DateTime.now().millisecondsSinceEpoch}',
          role: 'user',
          content: messageContent,
        ),
        ChatMessage(
          id: 'local-assistant-${DateTime.now().millisecondsSinceEpoch}',
          role: 'assistant',
          content: '',
          isStreaming: true,
        ),
      ];
      _controller.clear();
    });
    _scrollToBottom();

    try {
      final repository = ref.read(chatRepositoryProvider);
      var assistantIndex = _messages.length - 1;
      var assistant = _messages[assistantIndex];

      await for (final event in repository.sendMessageStream(sessionId, messageContent)) {
        if (!mounted) return;

        switch (event.type) {
          case ChatStreamEventType.meta:
            assistant = assistant.copyWith(
              confidence: event.confidence,
              followUps: event.followUps,
            );
          case ChatStreamEventType.token:
            assistant = assistant.copyWith(content: assistant.content + (event.text ?? ''));
          case ChatStreamEventType.citation:
            if (event.citation != null) {
              assistant = assistant.copyWith(citations: [...assistant.citations, event.citation!]);
            }
          case ChatStreamEventType.action:
            if (event.actionCard != null) {
              assistant = assistant.copyWith(actionCard: event.actionCard);
            }
          case ChatStreamEventType.scenario:
            if (event.scenarioCard != null) {
              assistant = assistant.copyWith(scenarioCard: event.scenarioCard);
            }
          case ChatStreamEventType.done:
            assistant = assistant.copyWith(
              id: event.messageId?.isNotEmpty == true ? event.messageId! : assistant.id,
              isStreaming: false,
            );
        }

        setState(() {
          _messages[assistantIndex] = assistant;
        });
        _scrollToBottom();
      }

      if (mounted) {
        setState(() {
          _messages[assistantIndex] = assistant.copyWith(isStreaming: false);
          _sending = false;
        });
        ref.read(isOfflineProvider.notifier).state = false;
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _retryContent = messageContent;
        if (_messages.isNotEmpty && _messages.last.isStreaming) {
          _messages = _messages.sublist(0, _messages.length - 1);
        }
      });
      if (_isConnectionError(error)) {
        ref.read(isOfflineProvider.notifier).state = true;
      }
    }
  }

  void _retryLastMessage() {
    final content = _retryContent;
    if (content == null || content.isEmpty) return;
    _sendMessage(content: content);
  }

  Future<void> _acceptAction(String messageId) async {
    final messageIndex = _messages.indexWhere((message) => message.id == messageId);
    if (messageIndex < 0) return;

    final card = _messages[messageIndex].actionCard;
    if (card == null || !card.isOpen || _busyActionId != null) return;

    setState(() => _busyActionId = card.recommendationId);

    try {
      final session = await ref.read(authSessionProvider.future);
      if (session == null) return;

      try {
        await RecommendationsRepository(session).accept(card.recommendationId);
      } catch (_) {
        if (AppConfig.canSkipSetup) {
          RecommendationsRepository.acceptLocally(card.recommendationId);
        } else {
          rethrow;
        }
      }
      if (!mounted) return;

      setState(() {
        _messages[messageIndex] = _messages[messageIndex].copyWith(
          actionCard: card.copyWith(status: 'accepted'),
        );
        _messages = [
          ..._messages,
          ChatMessage(
            id: 'local-confirm-${DateTime.now().millisecondsSinceEpoch}',
            role: 'assistant',
            content: "Got it — we'll track the impact over the next 30 days",
          ),
        ];
        _busyActionId = null;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busyActionId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not accept this action. Try again.')),
      );
    }
  }

  Future<void> _dismissAction(String messageId) async {
    final messageIndex = _messages.indexWhere((message) => message.id == messageId);
    if (messageIndex < 0) return;

    final card = _messages[messageIndex].actionCard;
    if (card == null || !card.isOpen || _busyActionId != null) return;

    setState(() => _busyActionId = card.recommendationId);

    try {
      final session = await ref.read(authSessionProvider.future);
      if (session == null) return;

      try {
        await RecommendationsRepository(session).dismiss(
          recommendationId: card.recommendationId,
          reason: DismissReason.notRelevant,
        );
      } catch (_) {
        if (AppConfig.canSkipSetup) {
          RecommendationsRepository.dismissLocally(card.recommendationId);
        } else {
          rethrow;
        }
      }
      if (!mounted) return;

      setState(() {
        _messages[messageIndex] = _messages[messageIndex].copyWith(
          actionCard: card.copyWith(status: 'dismissed'),
        );
        _messages = [
          ..._messages,
          ChatMessage(
            id: 'local-confirm-${DateTime.now().millisecondsSinceEpoch}',
            role: 'assistant',
            content: "Thanks — we'll improve future suggestions",
          ),
        ];
        _busyActionId = null;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busyActionId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not dismiss this action. Try again.')),
      );
    }
  }

  Future<void> _saveScenario(String messageId) async {
    final messageIndex = _messages.indexWhere((message) => message.id == messageId);
    if (messageIndex < 0) return;

    final card = _messages[messageIndex].scenarioCard;
    if (card == null || card.saved || _busyScenarioSaveId != null) return;

    setState(() => _busyScenarioSaveId = messageId);

    try {
      final payload = Map<String, dynamic>.from(card.savePayload);
      payload['source'] = 'chat';
      payload['chat_message_id'] = messageId.startsWith('local-') ? null : messageId;

      final saved = await ref.read(scenariosRepositoryProvider).saveScenario(payload);
      if (!mounted) return;

      setState(() {
        _messages[messageIndex] = _messages[messageIndex].copyWith(
          scenarioCard: card.copyWith(saved: true, scenarioId: saved.id),
        );
        _busyScenarioSaveId = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Saved "${saved.title}" to Scenario Planner')),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _busyScenarioSaveId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save scenario. Try again.')),
      );
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: MorganDuration.fast,
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _copyResponse(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Response copied'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final hasMessages = _messages.isNotEmpty;
    final isOffline = ref.watch(isOfflineProvider);
    final startersAsync = ref.watch(chatStartersProvider);
    final showEmptyStarters = !hasMessages && !_loadingSession;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Column(
          children: [
            const MorganScreenHeader(
              title: 'Ask Morgan',
              subtitle: 'Grounded in your store data',
            ),
            if (isOffline) const MorganOfflineBanner(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                child: Text(_error!, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
              ),
            Expanded(
              child: _loadingSession
                  ? Center(child: CircularProgressIndicator(color: p.accent))
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                      itemCount: hasMessages
                          ? _messages.length + 1 + (_retryContent != null ? 1 : 0)
                          : 1,
                      itemBuilder: (context, index) {
                        if (!hasMessages) {
                          return Padding(
                            padding: const EdgeInsets.only(top: MorganSpace.md, bottom: MorganSpace.xl),
                            child: MorganFadeIn(
                              child: MorganSurface(
                                color: p.surfaceMuted,
                                elevated: false,
                                child: Row(
                                  children: [
                                    MorganLogo(size: 32),
                                    const SizedBox(width: MorganSpace.md),
                                    Expanded(
                                      child: Text(
                                        'Ask about profit, cash, ads, or inventory. Every answer cites your data.',
                                        style: theme.textTheme.bodyMedium,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }

                        if (index == 0) {
                          return const SizedBox(height: MorganSpace.md);
                        }

                        final messageIndex = index - 1;
                        if (messageIndex >= _messages.length) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: MorganSpace.md),
                            child: _ChatErrorBubble(onRetry: _retryLastMessage),
                          );
                        }

                        final message = _messages[messageIndex];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: MorganSpace.md),
                          child: message.role == 'user'
                              ? _UserBubble(content: message.content)
                              : _AssistantBubble(
                                  message: message,
                                  onCopy: () => _copyResponse(message.content),
                                  onFollowUp: _sendStarter,
                                  followUpsEnabled: !_sending,
                                  onAcceptAction: message.actionCard?.isOpen == true
                                      ? () => _acceptAction(message.id)
                                      : null,
                                  onDismissAction: message.actionCard?.isOpen == true
                                      ? () => _dismissAction(message.id)
                                      : null,
                                  actionBusy: _busyActionId == message.actionCard?.recommendationId,
                                  onSaveScenario: message.scenarioCard != null && !message.scenarioCard!.saved
                                      ? () => _saveScenario(message.id)
                                      : null,
                                  scenarioSaveBusy: _busyScenarioSaveId == message.id,
                                ),
                        );
                      },
                    ),
            ),
            if (showEmptyStarters)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  MorganSpace.screenH,
                  0,
                  MorganSpace.screenH,
                  MorganSpace.sm,
                ),
                child: startersAsync.when(
                  data: (starters) => _SuggestedStarters(
                    starters: starters,
                    onTap: _sendStarter,
                    enabled: !_sending,
                  ),
                  loading: () => const _SuggestedStartersLoading(),
                  error: (_, __) => _SuggestedStarters(
                    starters: const [
                      ChatStarter(
                        label: 'Why did profit drop?',
                        message: 'Why did profit drop yesterday?',
                      ),
                      ChatStarter(label: 'Cash runway?', message: 'What is my cash runway?'),
                      ChatStarter(
                        label: 'Pause ads?',
                        message: 'Which campaigns should I pause?',
                      ),
                    ],
                    onTap: _sendStarter,
                    enabled: !_sending,
                  ),
                ),
              ),
            Container(
              padding: EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.sm,
                MorganSpace.screenH,
                MorganSpace.md + MediaQuery.viewInsetsOf(context).bottom,
              ),
              decoration: BoxDecoration(
                color: p.navBar,
                border: Border(top: BorderSide(color: p.borderSubtle)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      enabled: !_loadingSession && !_sending,
                      onSubmitted: (_) => _sendMessage(),
                      style: theme.textTheme.bodyLarge?.copyWith(color: p.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Ask Morgan anything…',
                        hintStyle: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
                        filled: true,
                        fillColor: p.surfaceMuted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(MorganRadius.sm),
                          borderSide: BorderSide(color: p.borderSubtle),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(MorganRadius.sm),
                          borderSide: BorderSide(color: p.borderSubtle),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(MorganRadius.sm),
                          borderSide: BorderSide(color: p.accent, width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: MorganSpace.md,
                          vertical: MorganSpace.sm,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: MorganSpace.sm),
                  Semantics(
                    button: true,
                    label: _sending ? 'Sending message' : 'Send message',
                    child: FilledButton(
                      onPressed: _loadingSession || _sending ? null : () => _sendMessage(),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(48, 48),
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(MorganRadius.sm),
                        ),
                      ),
                      child: _sending
                          ? SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: p.accentOn),
                            )
                          : const Icon(Icons.arrow_upward_rounded, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SuggestedStarters extends StatelessWidget {
  const _SuggestedStarters({
    required this.starters,
    required this.onTap,
    required this.enabled,
  });

  final List<ChatStarter> starters;
  final ValueChanged<String> onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visible = starters.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('SUGGESTED', style: theme.textTheme.labelMedium),
        const SizedBox(height: MorganSpace.sm),
        Wrap(
          spacing: MorganSpace.xs,
          runSpacing: MorganSpace.xs,
          children: visible
              .map(
                (starter) => MorganChip(
                  label: starter.label,
                  onTap: enabled ? () => onTap(starter.message) : () {},
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _SuggestedStartersLoading extends StatelessWidget {
  const _SuggestedStartersLoading();

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('SUGGESTED', style: theme.textTheme.labelMedium),
        const SizedBox(height: MorganSpace.sm),
        Wrap(
          spacing: MorganSpace.xs,
          runSpacing: MorganSpace.xs,
          children: List.generate(
            3,
            (_) => Container(
              width: 132,
              height: 32,
              decoration: BoxDecoration(
                color: p.surfaceMuted,
                borderRadius: BorderRadius.circular(MorganRadius.pill),
                border: Border.all(color: p.borderSubtle),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.content});

  final String content;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final maxWidth = MediaQuery.sizeOf(context).width * 0.85;

    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.md, vertical: MorganSpace.sm),
          decoration: BoxDecoration(
            color: p.accentMuted,
            borderRadius: BorderRadius.circular(MorganRadius.md),
          ),
          child: _FinanceRichText(
            text: content,
            style: theme.textTheme.bodyMedium?.copyWith(color: p.textPrimary),
          ),
        ),
      ),
    );
  }
}

class _AssistantBubble extends StatelessWidget {
  const _AssistantBubble({
    required this.message,
    required this.onCopy,
    required this.onFollowUp,
    required this.followUpsEnabled,
    this.onAcceptAction,
    this.onDismissAction,
    this.actionBusy = false,
    this.onSaveScenario,
    this.scenarioSaveBusy = false,
  });

  final ChatMessage message;
  final VoidCallback onCopy;
  final ValueChanged<String> onFollowUp;
  final bool followUpsEnabled;
  final VoidCallback? onAcceptAction;
  final VoidCallback? onDismissAction;
  final bool actionBusy;
  final VoidCallback? onSaveScenario;
  final bool scenarioSaveBusy;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final maxWidth = MediaQuery.sizeOf(context).width * 0.85;

    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: MorganSurface(
          color: p.surfaceMuted,
          elevated: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  MorganLogo(size: 20),
                  const SizedBox(width: MorganSpace.xs),
                  Text('Morgan', style: theme.textTheme.labelMedium),
                  const Spacer(),
                  if (message.confidence != null) _ConfidenceBadge(confidence: message.confidence!),
                ],
              ),
              const SizedBox(height: MorganSpace.sm),
              if (message.content.isEmpty && message.isStreaming)
                const MorganTypingIndicator()
              else
                _FinanceRichText(
                  text: message.content,
                  style: theme.textTheme.bodyMedium,
                ),
            if (message.citations.isNotEmpty) ...[
              const SizedBox(height: MorganSpace.md),
              Text('SOURCES', style: theme.textTheme.labelSmall),
              const SizedBox(height: MorganSpace.xs),
              Wrap(
                spacing: MorganSpace.xs,
                runSpacing: MorganSpace.xs,
                children: message.citations
                    .map(
                      (citation) => _CitationChip(citation: citation),
                    )
                    .toList(),
              ),
            ],
            if (message.actionCard != null && !message.isStreaming) ...[
              const SizedBox(height: MorganSpace.md),
              ChatInlineActionCard(
                actionCard: message.actionCard!,
                busy: actionBusy,
                onAccept: onAcceptAction ?? () {},
                onDismiss: onDismissAction ?? () {},
              ),
            ],
            if (message.scenarioCard != null && !message.isStreaming) ...[
              const SizedBox(height: MorganSpace.md),
              ChatInlineScenarioCard(
                scenarioCard: message.scenarioCard!,
                busy: scenarioSaveBusy,
                onSave: onSaveScenario ?? () {},
              ),
            ],
            if (!message.isStreaming && message.content.isNotEmpty) ...[
              const SizedBox(height: MorganSpace.sm),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onCopy,
                  icon: Icon(Icons.copy_rounded, size: 16, color: p.accent),
                  label: Text('Copy', style: theme.textTheme.labelMedium?.copyWith(color: p.accent)),
                ),
              ),
            ],
            if (!message.isStreaming && message.followUps.length >= 2) ...[
              const SizedBox(height: MorganSpace.sm),
              Text('FOLLOW UP', style: theme.textTheme.labelSmall),
              const SizedBox(height: MorganSpace.xs),
              Wrap(
                spacing: MorganSpace.xs,
                runSpacing: MorganSpace.xs,
                children: message.followUps
                    .map(
                      (label) => MorganChip(
                        label: label,
                        onTap: followUpsEnabled ? () => onFollowUp(label) : () {},
                      ),
                    )
                    .toList(),
              ),
            ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatErrorBubble extends StatelessWidget {
  const _ChatErrorBubble({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final maxWidth = MediaQuery.sizeOf(context).width * 0.85;

    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: MorganSurface(
          color: p.lossMuted,
          elevated: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Morgan could not answer right now.',
                style: theme.textTheme.bodyMedium?.copyWith(color: p.loss),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onRetry,
                  child: const Text('Retry'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FinanceRichText extends StatelessWidget {
  const _FinanceRichText({required this.text, this.style});

  final String text;
  final TextStyle? style;

  static final _financePattern = RegExp(r'(\$[\d,]+(?:\.\d{2})?|-?\d+(?:\.\d+)?%)');

  @override
  Widget build(BuildContext context) {
    final baseStyle = style ?? DefaultTextStyle.of(context).style;
    final monoStyle = baseStyle.copyWith(fontFamily: 'monospace');

    final spans = <TextSpan>[];
    var cursor = 0;
    for (final match in _financePattern.allMatches(text)) {
      if (match.start > cursor) {
        spans.add(TextSpan(text: text.substring(cursor, match.start), style: baseStyle));
      }
      spans.add(TextSpan(text: match.group(0), style: monoStyle));
      cursor = match.end;
    }
    if (cursor < text.length) {
      spans.add(TextSpan(text: text.substring(cursor), style: baseStyle));
    }

    return Text.rich(TextSpan(children: spans.isEmpty ? [TextSpan(text: text, style: baseStyle)] : spans));
  }
}

class _CitationChip extends StatelessWidget {
  const _CitationChip({required this.citation});

  final ChatCitation citation;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => ChatCitationDetailSheet.show(context, citation),
        borderRadius: BorderRadius.circular(MorganRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: MorganSpace.sm,
            vertical: MorganSpace.xxs,
          ),
          decoration: BoxDecoration(
            color: p.background,
            borderRadius: BorderRadius.circular(MorganRadius.pill),
            border: Border.all(color: citation.isStaleNow ? p.warning : p.borderSubtle),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${citation.displaySource} · ${citation.displayDate}',
                style: theme.textTheme.labelSmall?.copyWith(color: p.textSecondary),
              ),
              if (citation.isStaleNow) ...[
                const SizedBox(width: MorganSpace.xxs),
                Icon(Icons.warning_amber_rounded, size: 14, color: p.warning),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ConfidenceBadge extends StatelessWidget {
  const _ConfidenceBadge({required this.confidence});

  final String confidence;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final color = switch (confidence) {
      'high' => p.profit,
      'low' => p.warning,
      _ => p.accent,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.xxs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(MorganRadius.pill),
      ),
      child: Text(
        '${confidence[0].toUpperCase()}${confidence.substring(1)} confidence',
        style: theme.textTheme.labelSmall?.copyWith(color: color),
      ),
    );
  }
}
