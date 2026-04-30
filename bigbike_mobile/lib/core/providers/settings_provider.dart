import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../models/settings.dart';

final settingsProvider =
    AsyncNotifierProvider<SettingsNotifier, SiteSettings>(
        SettingsNotifier.new);

class SettingsNotifier extends AsyncNotifier<SiteSettings> {
  @override
  Future<SiteSettings> build() async {
    try {
      final data = await ApiClient()
          .get<Map<String, dynamic>>(ApiEndpoints.publicSettings);
      return SiteSettings.fromJson(data);
    } catch (_) {
      return const SiteSettings();
    }
  }
}
