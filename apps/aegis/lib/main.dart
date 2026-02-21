import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/aegis_app.dart';
import 'constants/app_config.dart';

void main() async {
  // Ensure Flutter bindings are initialized
  WidgetsFlutterBinding.ensureInitialized();

  // Run the app
  runApp(ProviderScope(child: AegisApp()));
}

/// Realpolitik Intelligence Platform Design System
/// Exact implementation of Next.js visual design - Based on actual Next.js CSS analysis
class DesignTokens {
  // Core Color Palette - Exact Next.js Implementation
  static const Color deepSpaceBlack = Color(0xFF020617);
  static const Color lightGray = Color(0xFFE2E8F0);
  static const Color purpleAccent = Color(0xFF6366F1);

  // Category Colors - Exact from Next.js with glow effects
  static const Color military = Color(0xFFEF4444);
  static const Color militaryGlow = Color(0x80EF4444); // rgba(239, 68, 68, 0.5)
  static const Color diplomacy = Color(0xFF22D3EE);
  static const Color diplomacyGlow = Color(
    0x8022D3EE,
  ); // rgba(34, 211, 238, 0.5)
  static const Color economy = Color(0xFF34D399);
  static const Color economyGlow = Color(0x8034D399); // rgba(52, 211, 153, 0.5)
  static const Color unrest = Color(0xFFFBBF24);
  static const Color unrestGlow = Color(0x80FBBF24); // rgba(251, 191, 36, 0.5)

  // Reaction Colors
  static const Color critical = Color(0xFFEF4444);
  static const Color market = Color(0xFFF59E0B);
  static const Color noise = Color(0xFF3B82F6);

  // UI Component Colors - Exact Next.js values
  static const Color panelBackground = Color(0x66000000); // rgba(0, 0, 0, 0.4)
  static const Color panelBorder = Color(
    0x1AFFFFFF,
  ); // rgba(255, 255, 255, 0.1)
  static const Color surface = Color(0x0F172A); // Dark slate
  static const Color surfaceVariant = Color(0xFF374151); // Slightly lighter
  static const Color muted = Color(0xFF94A3B8);
  static const Color outline = Color(0xFF475569);
  static const Color outlineVariant = Color(0xFF334155);
  static const Color error = Color(0xFFEF4444);

  // Font Sizes - Exact from Next.js
  static const double microSize = 9.0;
  static const double captionSize = 10.0;
  static const double smallSize = 12.0;
  static const double bodySize = 14.0;
  static const double baseSize = 16.0;
  static const double largeSize = 20.0;
  static const double xLargeSize = 24.0;

  // Font Weights - Exact Next.js patterns
  static const FontWeight light = FontWeight.w300;
  static const FontWeight normal = FontWeight.w400;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight semibold = FontWeight.w600;
  static const FontWeight bold = FontWeight.w700;

  // Spacing - Exact Next.js Tailwind spacing
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;

  // Border Radius - Exact Next.js values
  static const double smRadius = 6.0;
  static const double mdRadius = 8.0;
  static const double lgRadius = 12.0;
  static const double xlRadius = 16.0;
  static const double xxlRadius = 24.0;

  // Glass Panel Effect - Exact Next.js implementation
  static BoxDecoration glassPanelDecoration = BoxDecoration(
    color: panelBackground,
    borderRadius: BorderRadius.circular(lgRadius),
    border: Border.all(color: panelBorder, width: 1.0),
  );

  // Glow Effects - Exact Next.js implementation
  static BoxDecoration militaryGlowDecoration = BoxDecoration(
    color: militaryGlow,
    borderRadius: BorderRadius.circular(mdRadius),
    border: Border.all(color: military, width: 1.0),
    boxShadow: [
      BoxShadow(color: militaryGlow, blurRadius: 20, spreadRadius: 0),
    ],
  );

  static BoxDecoration diplomacyGlowDecoration = BoxDecoration(
    color: diplomacyGlow,
    borderRadius: BorderRadius.circular(mdRadius),
    border: Border.all(color: diplomacy, width: 1.0),
    boxShadow: [
      BoxShadow(color: diplomacyGlow, blurRadius: 20, spreadRadius: 0),
    ],
  );

  static BoxDecoration economyGlowDecoration = BoxDecoration(
    color: economyGlow,
    borderRadius: BorderRadius.circular(mdRadius),
    border: Border.all(color: economy, width: 1.0),
    boxShadow: [BoxShadow(color: economyGlow, blurRadius: 20, spreadRadius: 0)],
  );

  static BoxDecoration unrestGlowDecoration = BoxDecoration(
    color: unrestGlow,
    borderRadius: BorderRadius.circular(mdRadius),
    border: Border.all(color: unrest, width: 1.0),
    boxShadow: [BoxShadow(color: unrestGlow, blurRadius: 20, spreadRadius: 0)],
  );

  // Get category color by name
  static Color getCategoryColor(String category) {
    switch (category.toUpperCase()) {
      case 'MILITARY':
        return military;
      case 'DIPLOMACY':
        return diplomacy;
      case 'ECONOMY':
        return economy;
      case 'UNREST':
        return unrest;
      default:
        return lightGray;
    }
  }

  // Get category glow decoration by name
  static BoxDecoration getCategoryGlowDecoration(String category) {
    switch (category.toUpperCase()) {
      case 'MILITARY':
        return militaryGlowDecoration;
      case 'DIPLOMACY':
        return diplomacyGlowDecoration;
      case 'ECONOMY':
        return economyGlowDecoration;
      case 'UNREST':
        return unrestGlowDecoration;
      default:
        return BoxDecoration(
          color: panelBackground,
          borderRadius: BorderRadius.circular(mdRadius),
          border: Border.all(color: panelBorder),
        );
    }
  }
}

/// Typography System - Exact Next.js fonts and weights
class AppTypography {
  // Primary Font: Outfit (Exact Next.js configuration)
  static TextStyle get headingLarge => GoogleFonts.outfit(
    fontSize: DesignTokens.xLargeSize,
    fontWeight: DesignTokens.bold,
    color: DesignTokens.lightGray,
  );

  static TextStyle get headingMedium => GoogleFonts.outfit(
    fontSize: DesignTokens.largeSize,
    fontWeight: DesignTokens.bold,
    color: DesignTokens.lightGray,
  );

  static TextStyle get headingSmall => GoogleFonts.outfit(
    fontSize: DesignTokens.baseSize,
    fontWeight: DesignTokens.semibold,
    color: DesignTokens.lightGray,
  );

  static TextStyle get title => GoogleFonts.outfit(
    fontSize: DesignTokens.bodySize,
    fontWeight: DesignTokens.medium,
    color: DesignTokens.lightGray,
  );

  static TextStyle get body => GoogleFonts.outfit(
    fontSize: DesignTokens.bodySize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray,
  );

  static TextStyle get bodyMuted => GoogleFonts.outfit(
    fontSize: DesignTokens.bodySize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
  );

  static TextStyle get bodySecondary => GoogleFonts.outfit(
    fontSize: DesignTokens.bodySize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray.withValues(alpha: 0.7),
  );

  static TextStyle get caption => GoogleFonts.outfit(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
  );

  static TextStyle get captionBold => GoogleFonts.outfit(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.semibold,
    color: DesignTokens.lightGray,
  );

  static TextStyle get micro => GoogleFonts.outfit(
    fontSize: DesignTokens.captionSize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
  );

  // Monospace: JetBrains Mono (Exact Next.js configuration)
  static TextStyle get mono => GoogleFonts.jetBrainsMono(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray,
  );

  static TextStyle get monoBold => GoogleFonts.jetBrainsMono(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.bold,
    color: DesignTokens.lightGray,
  );

  static TextStyle get monoSmall => GoogleFonts.jetBrainsMono(
    fontSize: 10.0,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
  );

  static TextStyle get monoMicro => GoogleFonts.jetBrainsMono(
    fontSize: 9.0,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
    letterSpacing: 1.0,
  );

  // Button Styles - Exact Next.js patterns
  static TextStyle get button => GoogleFonts.jetBrainsMono(
    fontSize: 12.0,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray,
    letterSpacing: 1.0,
  );

  static TextStyle get buttonSmall => GoogleFonts.jetBrainsMono(
    fontSize: 10.0,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray,
    letterSpacing: 1.0,
  );

  static TextStyle get buttonUppercase => GoogleFonts.jetBrainsMono(
    fontSize: 12.0,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray,
    letterSpacing: 1.0,
  );

  static TextStyle get buttonSecondary => GoogleFonts.jetBrainsMono(
    fontSize: 12.0,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
    letterSpacing: 1.0,
  );

  // Interactive Elements
  static TextStyle get label => GoogleFonts.outfit(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.semibold,
    color: DesignTokens.lightGray,
  );

  static TextStyle get labelSmall => GoogleFonts.outfit(
    fontSize: DesignTokens.microSize,
    fontWeight: DesignTokens.medium,
    color: DesignTokens.lightGray,
    letterSpacing: 0.5,
  );

  static TextStyle get overline => GoogleFonts.outfit(
    fontSize: DesignTokens.microSize,
    fontWeight: DesignTokens.medium,
    color: DesignTokens.muted,
    letterSpacing: 1.0,
  );

  // Category-specific styles
  static TextStyle get categoryLabel => GoogleFonts.outfit(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.lightGray,
  );

  static TextStyle get categoryLabelBold => GoogleFonts.outfit(
    fontSize: DesignTokens.smallSize,
    fontWeight: DesignTokens.semibold,
    color: DesignTokens.lightGray,
  );

  // Utility methods for exact color combinations
  static TextStyle whiteText([double size = DesignTokens.bodySize]) =>
      GoogleFonts.outfit(
        fontSize: size,
        fontWeight: DesignTokens.normal,
        color: Colors.white,
      );

  static TextStyle grayText([double size = DesignTokens.bodySize]) =>
      GoogleFonts.outfit(
        fontSize: size,
        fontWeight: DesignTokens.normal,
        color: DesignTokens.lightGray.withValues(alpha: 0.7),
      );

  static TextStyle mutedText([double size = DesignTokens.bodySize]) =>
      GoogleFonts.outfit(
        fontSize: size,
        fontWeight: DesignTokens.normal,
        color: DesignTokens.muted,
      );

  // Timestamp formatting
  static TextStyle get timestamp => GoogleFonts.jetBrainsMono(
    fontSize: DesignTokens.captionSize,
    fontWeight: DesignTokens.normal,
    color: DesignTokens.muted,
  );

  // Status indicators
  static TextStyle get status => GoogleFonts.jetBrainsMono(
    fontSize: 10.0,
    fontWeight: DesignTokens.medium,
    color: Colors.green,
    letterSpacing: 0.5,
  );
}

/// Glass Panel Widget - Exact Next.js glassmorphism implementation
class GlassPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final BoxDecoration? decoration;
  final VoidCallback? onTap;
  final String? tooltip;

  const GlassPanel({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.borderRadius,
    this.decoration,
    this.onTap,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveDecoration =
        decoration ??
        DesignTokens.glassPanelDecoration.copyWith(
          borderRadius: borderRadius?.resolve(TextDirection.ltr),
        );

    final widget = Container(
      width: width,
      height: height,
      margin: margin ?? EdgeInsets.zero,
      decoration: effectiveDecoration,
      child: ClipRRect(
        borderRadius:
            (borderRadius ?? BorderRadius.circular(DesignTokens.lgRadius))
                .resolve(TextDirection.ltr),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(padding: padding ?? EdgeInsets.zero, child: child),
        ),
      ),
    );

    if (tooltip != null && onTap != null) {
      return Tooltip(
        message: tooltip!,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(
            borderRadius?.resolve(TextDirection.ltr).bottomLeft.x ??
                DesignTokens.lgRadius,
          ),
          child: widget,
        ),
      );
    }

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(
          borderRadius?.resolve(TextDirection.ltr).bottomLeft.x ??
              DesignTokens.lgRadius,
        ),
        child: widget,
      );
    }

    return widget;
  }
}

/// Glass Panel with Glow Effect - Exact Next.js implementation
class GlassPanelGlow extends StatelessWidget {
  final Widget child;
  final Color glowColor;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  const GlassPanelGlow({
    super.key,
    required this.child,
    required this.glowColor,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      margin: margin ?? EdgeInsets.zero,
      decoration: BoxDecoration(
        color: glowColor.withValues(alpha: 0.5),
        borderRadius:
            borderRadius ?? BorderRadius.circular(DesignTokens.mdRadius),
        border: Border.all(color: glowColor, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: glowColor.withValues(alpha: 0.5),
            blurRadius: 20,
            spreadRadius: 0,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius:
            (borderRadius ?? BorderRadius.circular(DesignTokens.mdRadius))
                .resolve(TextDirection.ltr),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(padding: padding ?? EdgeInsets.zero, child: child),
        ),
      ),
    );
  }
}

/// Pulse Animation for Category Events - Exact Next.js implementation
class PulseGlow extends StatefulWidget {
  final Widget child;
  final Color glowColor;
  final Duration duration;
  final bool enabled;

  const PulseGlow({
    super.key,
    required this.child,
    required this.glowColor,
    this.duration = const Duration(milliseconds: 2000),
    this.enabled = true,
  });

  @override
  State<PulseGlow> createState() => _PulseGlowState();
}

class _PulseGlowState extends State<PulseGlow>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacityAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(duration: widget.duration, vsync: this);
    _opacityAnimation = Tween<double>(
      begin: 1.0,
      end: 0.7,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    if (widget.enabled) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: Opacity(opacity: _opacityAnimation.value, child: widget.child),
        );
      },
    );
  }
}

/// Enhanced Theme with Next.js Design System
class AppTheme {
  static ThemeData createTheme() {
    return ThemeData(
      useMaterial3: false,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme.dark(
        primary: DesignTokens.purpleAccent,
        secondary: DesignTokens.diplomacy,
        tertiary: DesignTokens.economy,
        surface: DesignTokens.deepSpaceBlack,
        onSurface: DesignTokens.lightGray,
        error: DesignTokens.error,
        onError: DesignTokens.lightGray,
      ),
      textTheme: TextTheme(
        displayLarge: AppTypography.headingLarge,
        displayMedium: AppTypography.headingMedium,
        displaySmall: AppTypography.headingSmall,
        headlineLarge: AppTypography.headingLarge,
        headlineMedium: AppTypography.headingMedium,
        headlineSmall: AppTypography.headingSmall,
        titleLarge: AppTypography.title,
        titleMedium: AppTypography.title,
        titleSmall: AppTypography.label,
        bodyLarge: AppTypography.body,
        bodyMedium: AppTypography.body,
        bodySmall: AppTypography.caption,
        labelLarge: AppTypography.label,
        labelMedium: AppTypography.buttonSmall,
        labelSmall: AppTypography.overline,
      ),
    );
  }
}
