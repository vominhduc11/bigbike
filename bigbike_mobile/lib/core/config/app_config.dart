import 'package:flutter/foundation.dart';

class AppConfig {
  // For Android emulator: 10.0.2.2; iOS simulator: localhost; physical device: LAN IP
  static const String _androidEmulatorBase = 'http://10.0.2.2:8080';
  static const String _defaultBase = 'http://localhost:8080';

  static String get apiBaseUrl {
    if (kDebugMode && defaultTargetPlatform == TargetPlatform.android) {
      return _androidEmulatorBase;
    }
    return _defaultBase;
  }

  // Media is served via the Next.js /media/* rewrite (proxies to MinIO).
  // In release builds, use the production web server so /media/* resolves correctly.
  // In debug builds, point to the local Next.js dev server (port 3000).
  static const String _mediaProd = 'https://bigbike.vn';
  static const String _mediaAndroidDebug = 'http://10.0.2.2:3000';
  static const String _mediaDefaultDebug = 'http://localhost:3000';

  static String get mediaBaseUrl {
    if (!kDebugMode) return _mediaProd;
    if (defaultTargetPlatform == TargetPlatform.android) return _mediaAndroidDebug;
    return _mediaDefaultDebug;
  }
}
