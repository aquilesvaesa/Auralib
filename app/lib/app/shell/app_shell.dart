import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Navegación principal: **Biblioteca**, **Descubre**, **Ajustes** (barra o rail ≥600dp).
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = <_NavDest>[
    _NavDest(
      label: 'Biblioteca',
      icon: Icons.library_music_outlined,
      selectedIcon: Icons.library_music,
    ),
    _NavDest(
      label: 'Descubre',
      icon: Icons.explore_outlined,
      selectedIcon: Icons.explore,
    ),
    _NavDest(
      label: 'Ajustes',
      icon: Icons.settings_outlined,
      selectedIcon: Icons.settings,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final maxIndex = _destinations.length - 1;
    final rawIndex = navigationShell.currentIndex;
    final safeIndex = rawIndex.clamp(0, maxIndex);
    if (safeIndex != rawIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        if (navigationShell.currentIndex == rawIndex) {
          navigationShell.goBranch(safeIndex);
        }
      });
    }

    final width = MediaQuery.sizeOf(context).width;
    final useRail = width >= 600;
    final extendedRail = width >= 900;

    void goBranch(int index) {
      navigationShell.goBranch(
        index,
        initialLocation: index == navigationShell.currentIndex,
      );
    }

    if (useRail) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              extended: extendedRail,
              selectedIndex: safeIndex,
              onDestinationSelected: goBranch,
              labelType: extendedRail
                  ? NavigationRailLabelType.all
                  : NavigationRailLabelType.selected,
              destinations: [
                for (final d in _destinations)
                  NavigationRailDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.selectedIcon),
                    label: Text(d.label),
                  ),
              ],
            ),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(child: navigationShell),
          ],
        ),
      );
    }

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: goBranch,
        destinations: [
          for (final d in _destinations)
            NavigationDestination(
              icon: Icon(d.icon),
              selectedIcon: Icon(d.selectedIcon),
              label: d.label,
            ),
        ],
      ),
    );
  }
}

class _NavDest {
  const _NavDest({
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}
