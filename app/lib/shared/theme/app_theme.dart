import 'package:flutter/material.dart';

/// Tema Material 3 de AuraLib.
///
/// **Claro:** identidad cobre (AuraLib).
/// **Oscuro:** paleta validada en DacToDock (referencia Qobuz): fondos #0D0D0F / superficies
/// #1A1D24 y acento #00C853 — ver `DacToDock/.../colors.xml` y `PROPUESTA_UI_NAVEGACION_QOBUZ.md`.
class AppTheme {
  static const _seedLight = Color(0xFFC77A4A);
  static const _seedDark = Color(0xFF00C853);

  /// Fondos y superficies legacy (oscuro).
  static const _qBackground = Color(0xFF0D0D0F);
  static const _qSurface = Color(0xFF1A1D24);
  static const _qSurfaceVariant = Color(0xFF1E2329);
  static const _qNavBar = Color(0xFF15191E);
  static const _qTextSecondary = Color(0xFFAAB4BE);
  static const _qTextTertiary = Color(0xFF6E7781);
  static const _qDivider = Color(0xFF2A2D35);

  static ThemeData light() => _buildLight();

  static ThemeData dark() => _buildDark();

  static ThemeData _buildLight() {
    final scheme = ColorScheme.fromSeed(seedColor: _seedLight, brightness: Brightness.light);
    return _commonTheme(scheme).copyWith(
      scaffoldBackgroundColor: scheme.surface,
    );
  }

  static ThemeData _buildDark() {
    final base = ColorScheme.fromSeed(
      seedColor: _seedDark,
      brightness: Brightness.dark,
      surface: _qBackground,
    );
    final scheme = base.copyWith(
      surface: _qBackground,
      surfaceContainerLowest: _qBackground,
      surfaceContainerLow: _qSurface,
      surfaceContainer: _qSurface,
      surfaceContainerHigh: _qSurfaceVariant,
      surfaceContainerHighest: _qSurfaceVariant,
      onSurfaceVariant: _qTextSecondary,
      outline: _qDivider,
      outlineVariant: _qDivider,
    );
    return _commonTheme(scheme).copyWith(
      scaffoldBackgroundColor: _qBackground,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: _qBackground,
        foregroundColor: scheme.onSurface,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        backgroundColor: _qNavBar,
        indicatorColor: const Color(0x3300C853),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return TextStyle(color: scheme.primary, fontWeight: FontWeight.w600, fontSize: 12);
          }
          return TextStyle(color: _qTextTertiary, fontSize: 12);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: scheme.primary);
          }
          return IconThemeData(color: _qTextSecondary);
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: _qNavBar,
        indicatorColor: const Color(0x3300C853),
        selectedIconTheme: IconThemeData(color: scheme.primary),
        unselectedIconTheme: IconThemeData(color: _qTextSecondary),
        selectedLabelTextStyle: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600),
        unselectedLabelTextStyle: const TextStyle(color: _qTextTertiary),
      ),
    );
  }

  static ThemeData _commonTheme(ColorScheme scheme) {
    return ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        backgroundColor: scheme.surface,
        indicatorColor: scheme.primaryContainer,
      ),
      cardTheme: CardThemeData(
        color: scheme.surfaceContainerHighest,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}
