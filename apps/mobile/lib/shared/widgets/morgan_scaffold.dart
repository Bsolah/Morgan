import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';

/// Scaffold with palette background — use for full-screen routes outside [MorganShell].
class MorganScaffold extends StatelessWidget {
  const MorganScaffold({
    super.key,
    this.appBar,
    required this.body,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.resizeToAvoidBottomInset,
  });

  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final bool? resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Scaffold(
      backgroundColor: p.background,
      appBar: appBar,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
    );
  }
}
