import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_back_button.dart';
import 'morgan_icon_button.dart';

/// Unified app bar for deep routes (US-UX-16-01).
class MorganDetailAppBar extends StatelessWidget implements PreferredSizeWidget {
  const MorganDetailAppBar({
    super.key,
    required this.title,
    this.actions,
    this.fallbackRoute = '/home',
  });

  final String title;
  final List<Widget>? actions;
  final String fallbackRoute;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return AppBar(
      backgroundColor: p.background,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      leading: MorganBackButton(fallbackRoute: fallbackRoute),
      title: Text(
        title,
        style: theme.textTheme.titleMedium,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      actions: actions,
    );
  }
}

/// Icon-only app bar action with tooltip (US-UX-16-01).
class MorganDetailAppBarAction extends StatelessWidget {
  const MorganDetailAppBarAction({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return MorganIconButton(
      icon: icon,
      label: tooltip,
      onPressed: onPressed,
      color: p.textPrimary,
    );
  }
}

/// Scaffold wrapper for pushed detail routes (US-UX-16-01).
class MorganDetailScaffold extends StatelessWidget {
  const MorganDetailScaffold({
    super.key,
    required this.title,
    required this.body,
    this.fallbackRoute = '/home',
    this.actions,
    this.bottomBar,
  });

  final String title;
  final Widget body;
  final String fallbackRoute;
  final List<Widget>? actions;
  final Widget? bottomBar;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Scaffold(
      backgroundColor: p.background,
      appBar: MorganDetailAppBar(
        title: title,
        fallbackRoute: fallbackRoute,
        actions: actions,
      ),
      body: body,
      bottomNavigationBar: bottomBar,
    );
  }
}

Color impactColorForUsd(MorganPalette p, int impactHighUsd) {
  if (impactHighUsd >= 1000) return p.profit;
  if (impactHighUsd >= 400) return p.warning;
  return p.accent;
}
