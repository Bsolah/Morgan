import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/alerts/alerts_providers.dart';

import '../../core/theme/morgan_colors.dart';

import '../../core/theme/morgan_tokens.dart';

import 'morgan_shell_tab_fade.dart';

class MorganShell extends ConsumerWidget {

  const MorganShell({super.key, required this.navigationShell});



  final StatefulNavigationShell navigationShell;



  static const _items = [

    _NavItem(Icons.home_rounded, Icons.home_outlined, 'Brief'),

    _NavItem(Icons.bolt_rounded, Icons.bolt_outlined, 'Actions'),

    _NavItem(Icons.chat_rounded, Icons.chat_outlined, 'Ask'),

    _NavItem(Icons.notifications_rounded, Icons.notifications_outlined, 'Alerts'),

    _NavItem(Icons.tune_rounded, Icons.tune_outlined, 'Settings'),

  ];



  static const _alertsTabIndex = 3;



  void _onTap(int index) {

    navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex);

  }



  @override

  Widget build(BuildContext context, WidgetRef ref) {

    final p = context.morgan;

    final theme = Theme.of(context);

    final unreadCount = ref.watch(unreadAlertsCountProvider).valueOrNull ?? 0;



    return Scaffold(

      backgroundColor: p.background,

      body: MorganShellTabFade(navigationShell: navigationShell),

      bottomNavigationBar: Container(

        decoration: BoxDecoration(

          color: p.navBar,

          border: Border(top: BorderSide(color: p.borderSubtle)),

        ),

        child: SafeArea(

          top: false,

          child: Padding(

            padding: const EdgeInsets.symmetric(

              horizontal: MorganSpace.xs,

              vertical: MorganSpace.xs,

            ),

            child: Row(

              children: List.generate(_items.length, (i) {

                final item = _items[i];

                final selected = navigationShell.currentIndex == i;

                return Expanded(

                  child: _ShellTab(

                    item: item,

                    selected: selected,

                    showBadgeSlot: i == _alertsTabIndex,

                    badgeCount: i == _alertsTabIndex ? unreadCount : 0,

                    onTap: () => _onTap(i),

                    palette: p,

                    labelStyle: theme.textTheme.labelSmall,

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



class _ShellTab extends StatelessWidget {

  const _ShellTab({

    required this.item,

    required this.selected,

    required this.showBadgeSlot,

    required this.badgeCount,

    required this.onTap,

    required this.palette,

    required this.labelStyle,

  });



  final _NavItem item;

  final bool selected;

  final bool showBadgeSlot;

  final int badgeCount;

  final VoidCallback onTap;

  final MorganPalette palette;

  final TextStyle? labelStyle;



  @override

  Widget build(BuildContext context) {

    final p = palette;



    return Semantics(

      button: true,

      selected: selected,

      label: item.label,

      child: Material(

        color: Colors.transparent,

        child: InkWell(

          onTap: onTap,

          borderRadius: BorderRadius.circular(MorganRadius.sm),

          child: ConstrainedBox(

            constraints: const BoxConstraints(minHeight: 48, minWidth: 44),

            child: AnimatedContainer(

              duration: MorganDuration.fast,

              padding: const EdgeInsets.symmetric(

                horizontal: MorganSpace.xxs,

                vertical: MorganSpace.xs,

              ),

              decoration: BoxDecoration(

                color: selected ? p.accentMuted.withValues(alpha: p.isDark ? 0.65 : 1) : Colors.transparent,

                borderRadius: BorderRadius.circular(MorganRadius.sm),

              ),

              child: Column(

                mainAxisAlignment: MainAxisAlignment.center,

                mainAxisSize: MainAxisSize.min,

                children: [

                  SizedBox(

                    width: 32,

                    height: 24,

                    child: Stack(

                      clipBehavior: Clip.none,

                      alignment: Alignment.center,

                      children: [

                        Icon(

                          selected ? item.selected : item.icon,

                          size: 22,

                          color: selected ? p.accent : p.textMuted,

                        ),

                        if (showBadgeSlot && badgeCount > 0)

                          Positioned(

                            right: -2,

                            top: -6,

                            child: _AlertsBadge(count: badgeCount, palette: p, labelStyle: labelStyle),

                          ),

                      ],

                    ),

                  ),

                  const SizedBox(height: MorganSpace.xxs),

                  Text(

                    item.label,

                    maxLines: 1,

                    overflow: TextOverflow.ellipsis,

                    style: labelStyle?.copyWith(

                      color: selected ? p.textPrimary : p.textMuted,

                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,

                    ),

                  ),

                ],

              ),

            ),

          ),

        ),

      ),

    );

  }

}



class _AlertsBadge extends StatelessWidget {

  const _AlertsBadge({

    required this.count,

    required this.palette,

    required this.labelStyle,

  });



  final int count;

  final MorganPalette palette;

  final TextStyle? labelStyle;



  @override

  Widget build(BuildContext context) {

    final p = palette;

    final label = count > 9 ? '9+' : '$count';



    return Container(

      padding: const EdgeInsets.symmetric(

        horizontal: MorganSpace.xxs + 1,

        vertical: MorganSpace.xxs,

      ),

      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),

      decoration: BoxDecoration(

        color: p.warning,

        borderRadius: BorderRadius.circular(MorganRadius.xs),

        border: Border.all(color: p.navBar, width: 1.5),

      ),

      child: Text(

        label,

        textAlign: TextAlign.center,

        style: labelStyle?.copyWith(

          color: p.accentOn,

          fontSize: 9,

          fontWeight: FontWeight.w700,

          height: 1,

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


