import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_chip.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _sendStarter(String text) {
    setState(() => _controller.text = text);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Column(
          children: [
            const MorganScreenHeader(
              title: 'Ask Morgan',
              subtitle: 'Grounded in your store data',
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                children: [
                  MorganFadeIn(
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
                  const SizedBox(height: MorganSpace.xl),
                  Text('SUGGESTED', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  Wrap(
                    spacing: MorganSpace.xs,
                    runSpacing: MorganSpace.xs,
                    children: [
                      MorganChip(label: 'Why did profit drop?', onTap: () => _sendStarter('Why did profit drop yesterday?')),
                      MorganChip(label: 'Cash runway?', onTap: () => _sendStarter('What is my cash runway?')),
                      MorganChip(label: 'Pause ads?', onTap: () => _sendStarter('Which campaigns should I pause?')),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.sm,
                MorganSpace.screenH,
                MorganSpace.md,
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
                  FilledButton(
                    onPressed: () {},
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(48, 48),
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MorganRadius.sm)),
                    ),
                    child: const Icon(Icons.arrow_upward_rounded, size: 20),
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
