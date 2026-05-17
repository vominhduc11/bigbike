import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/providers/settings_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';

class ContactScreen extends ConsumerStatefulWidget {
  const ContactScreen({super.key});

  @override
  ConsumerState<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends ConsumerState<ContactScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  bool _loading = false;
  bool _sent = false;

  @override
  void dispose() {
    for (final c in [_nameCtrl, _phoneCtrl, _emailCtrl, _messageCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('Liên hệ')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Contact info
          if (settings != null) ...[
            _ContactInfo(settings: settings),
            const SizedBox(height: 24),
          ],

          if (_sent)
            _SuccessCard()
          else
            _ContactForm(
              formKey: _formKey,
              nameCtrl: _nameCtrl,
              phoneCtrl: _phoneCtrl,
              emailCtrl: _emailCtrl,
              messageCtrl: _messageCtrl,
              loading: _loading,
              onSubmit: _submit,
            ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ApiClient().post(ApiEndpoints.contact, data: {
        'fullName': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'message': _messageCtrl.text.trim(),
      });
      setState(() => _sent = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Lỗi: $e'),
              backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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

class _ContactForm extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl, phoneCtrl, emailCtrl, messageCtrl;
  final bool loading;
  final VoidCallback onSubmit;

  const _ContactForm({
    required this.formKey,
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.emailCtrl,
    required this.messageCtrl,
    required this.loading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Gửi tin nhắn',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextFormField(
            controller: nameCtrl,
            validator: (v) => Validators.required(v, 'Họ tên'),
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(labelText: 'Họ tên *'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: phoneCtrl,
            validator: Validators.phone,
            keyboardType: TextInputType.phone,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(labelText: 'Số điện thoại *'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: emailCtrl,
            validator: (v) =>
                v?.isNotEmpty == true ? Validators.email(v) : null,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: messageCtrl,
            validator: (v) => Validators.required(v, 'Nội dung'),
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
                labelText: 'Nội dung *', alignLabelWithHint: true),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: loading ? null : onSubmit,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(52)),
            child: loading
                ? const SizedBox(
                    width: 22, height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Gửi tin nhắn'),
          ),
        ],
      ),
    );
  }
}

class _SuccessCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: const Column(
        children: [
          Icon(Icons.check_circle_outline,
              color: AppColors.success, size: 56),
          SizedBox(height: 12),
          Text('Đã gửi thành công!',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700)),
          SizedBox(height: 8),
          Text(
            'Chúng tôi sẽ liên hệ với bạn sớm nhất có thể.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
