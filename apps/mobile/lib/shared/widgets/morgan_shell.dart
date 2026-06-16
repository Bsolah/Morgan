import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

class MorganShell extends StatelessWidget {
  const MorganShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _items = [
    _NavItem(Icons.home_rounded, Icons.home_outlined, 'Brief'),
    _NavItem(Icons.bolt_rounded, Icons.bolt_outlined, 'Actions'),
    _NavItem(Icons.chat_rounded, Icons.chat_outlined, 'Ask'),
    _NavItem(Icons.notifications_rounded, Icons.notifications_outlined, 'Alerts'),
    _NavItem(Icons.tune_rounded, Icons.tune_outlined, 'Settings'),
  ];

  void _onTap(int index) {
    navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: p.background,
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: p.navBar,
          border: Border(top: BorderSide(color: p.borderSubtle)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xs, vertical: MorganSpace.xs),
            child: Row(
              children: List.generate(_items.length, (i) {
                final item = _items[i];
                final selected = navigationShell.currentIndex == i;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => _onTap(i),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: MorganDuration.fast,
                      padding: const EdgeInsets.symmetric(vertical: MorganSpace.xs),
                      decoration: BoxDecoration(
                        color: selected ? p.accentMuted.withValues(alpha: p.isDark ? 0.6 : 1) : Colors.transparent,
                        borderRadius: BorderRadius.circular(MorganRadius.sm),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            selected ? item.selected : item.icon,
                            size: 22,
                            color: selected ? p.accent : p.textMuted,
                          ),
                          const SizedBox(height: MorganSpace.xxs),
                          Text(
                            item.label,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: selected ? p.accent : p.textMuted,
                              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.selected, this.icon, this.label);
  final IconData selected;
  final IconData icon;
  final String label;
}
