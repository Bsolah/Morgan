import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';

/// Info icon with tooltip, Semantics label, and 44pt touch target.
class MorganInfoTooltip extends StatelessWidget {
  const MorganInfoTooltip({
    super.key,
    required this.message,
    this.semanticsLabel,
  });

  final String message;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Semantics(
      button: true,
      label: semanticsLabel ?? message,
      child: Tooltip(
        message: message,
        triggerMode: TooltipTriggerMode.tap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
          child: Align(
            alignment: Alignment.center,
            child: Icon(Icons.info_outline, size: 16, color: p.textMuted),
          ),
        ),
      ),
    );
  }
}
