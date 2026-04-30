import 'package:flutter/material.dart';

class AppColors {
  // Brand
  static const Color primary = Color(0xFFF90606);
  static const Color primaryHover = Color(0xFFD90404);
  static const Color primarySoft = Color(0x1FF90606);

  // Background (dark-first)
  static const Color bgPage = Color(0xFF0A0A0A);
  static const Color bgSection = Color(0xFF191919);
  static const Color bgSurface = Color(0xFF141414);
  static const Color bgSurfaceRaised = Color(0xFF202020);
  static const Color bgSurfaceHover = Color(0xFF292929);

  // Text
  static const Color textPrimary = Color(0xF5FFFFFF); // 96% white
  static const Color textSecondary = Color(0xBCFFFFFF); // 74% white
  static const Color textMuted = Color(0x8FFFFFFF); // 56% white
  static const Color textDisabled = Color(0x5CFFFFFF); // 36% white
  static const Color textBrand = primary;
  static const Color textInverse = Color(0xFF111111);

  // Borders
  static const Color borderSubtle = Color(0x1AFFFFFF); // 10% white
  static const Color borderDefault = Color(0x33FFFFFF); // 20% white
  static const Color borderBrand = Color(0x5CF90606); // 36% red

  // Status
  static const Color success = Color(0xFF62BB46);
  static const Color warning = Color(0xFFF99D1C);
  static const Color error = Color(0xFFE1058C);
  static const Color info = Color(0xFF20C4F4);

  // Other
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF0A0A0A);
  static const Color divider = Color(0x1AFFFFFF);
}
