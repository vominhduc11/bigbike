import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/providers/settings_provider.dart';
import '../../core/theme/app_colors.dart';

class ContactScreen extends ConsumerWidget {
  const ContactScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('Liên hệ')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (settings != null)
            _ContactInfo(settings: settings)
          else
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(
                child: Text(
                  'Đang tải thông tin liên hệ...',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ContactInfo extends StatelessWidget {
  final dynamic settings;
  const _ContactInfo({required this.settings});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          if (settings.hotline != null)
            _InfoRow(
              icon: Icons.phone,
              label: settings.hotline!,
              onTap: () => launchUrl(Uri.parse('tel:${settings.hotline}')),
            ),
          if (settings.email != null)
            _InfoRow(
              icon: Icons.email_outlined,
              label: settings.email!,
              onTap: () =>
                  launchUrl(Uri.parse('mailto:${settings.email}')),
            ),
          if (settings.address != null)
            _InfoRow(
              icon: Icons.location_on_outlined,
              label: settings.address!,
            ),
          if (settings.zaloUrl != null)
            _InfoRow(
              icon: Icons.chat_outlined,
              label: 'Chat Zalo',
              onTap: () => launchUrl(Uri.parse(settings.zaloUrl!)),
            ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  const _InfoRow({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: GestureDetector(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: onTap != null
                      ? AppColors.primary
                      : AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
