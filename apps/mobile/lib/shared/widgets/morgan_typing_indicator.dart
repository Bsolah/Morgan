import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

class MorganTypingIndicator extends StatefulWidget {
  const MorganTypingIndicator({super.key});

  @override
  State<MorganTypingIndicator> createState() => _MorganTypingIndicatorState();
}

class _MorganTypingIndicatorState extends State<MorganTypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final phase = (_controller.value + (index * 0.2)) % 1.0;
            final opacity = 0.35 + (phase < 0.5 ? phase : 1 - phase) * 1.3;
            return Padding(
              padding: EdgeInsets.only(right: index < 2 ? MorganSpace.xxs : 0),
              child: Opacity(
                opacity: opacity.clamp(0.35, 1.0),
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: p.textMuted,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          },
        );
      }),
    );
  }
}
