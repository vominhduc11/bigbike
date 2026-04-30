import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/validators.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() =>
      _EditProfileScreenState();
}

class _EditProfileScreenState
    extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _oldPassCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  bool _loading = false;
  bool _changePass = false;

  @override
  void initState() {
    super.initState();
    final profile =
        ref.read(authProvider).valueOrNull?.profile;
    if (profile != null) {
      _nameCtrl.text = profile.displayName ?? '';
      _phoneCtrl.text = profile.phone ?? '';
      _emailCtrl.text = profile.email ?? '';
    }
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _phoneCtrl, _emailCtrl, _oldPassCtrl, _newPassCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chỉnh sửa hồ sơ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _nameCtrl,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration:
                    const InputDecoration(labelText: 'Tên hiển thị'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneCtrl,
                validator: (v) =>
                    v?.isNotEmpty == true ? Validators.phone(v) : null,
                keyboardType: TextInputType.phone,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration:
                    const InputDecoration(labelText: 'Số điện thoại'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailCtrl,
                validator: (v) =>
                    v?.isNotEmpty == true ? Validators.email(v) : null,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 16),
              CheckboxListTile(
                value: _changePass,
                onChanged: (v) =>
                    setState(() => _changePass = v ?? false),
                title: const Text('Đổi mật khẩu',
                    style: TextStyle(
                        color: AppColors.textPrimary, fontSize: 14)),
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
              ),
              if (_changePass) ...[
                TextFormField(
                  controller: _oldPassCtrl,
                  obscureText: true,
                  validator: (v) =>
                      _changePass && (v == null || v.isEmpty)
                          ? 'Nhập mật khẩu hiện tại'
                          : null,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration:
                      const InputDecoration(labelText: 'Mật khẩu hiện tại'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _newPassCtrl,
                  obscureText: true,
                  validator: (v) => _changePass
                      ? Validators.password(v)
                      : null,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration:
                      const InputDecoration(labelText: 'Mật khẩu mới'),
                ),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _save,
                style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52)),
                child: _loading
                    ? const SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Lưu thay đổi'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final data = <String, dynamic>{
        if (_nameCtrl.text.isNotEmpty) 'displayName': _nameCtrl.text.trim(),
        if (_phoneCtrl.text.isNotEmpty) 'phone': _phoneCtrl.text.trim(),
        if (_emailCtrl.text.isNotEmpty) 'email': _emailCtrl.text.trim(),
        if (_changePass && _newPassCtrl.text.isNotEmpty) ...{
          'currentPassword': _oldPassCtrl.text,
          'newPassword': _newPassCtrl.text,
        },
      };
      await ref.read(authProvider.notifier).updateProfile(data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Cập nhật thành công'),
              backgroundColor: AppColors.success),
        );
        Navigator.pop(context);
      }
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
