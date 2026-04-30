import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_colors.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản')),
      body: authAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                color: AppColors.primary)),
        error: (_, __) => _GuestView(),
        data: (state) => state.isAuthenticated
            ? _AccountView(profile: state.profile!)
            : _GuestView(),
      ),
    );
  }
}

class _GuestView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.person_outline,
                color: AppColors.textMuted, size: 72),
            const SizedBox(height: 16),
            const Text('Đăng nhập để xem tài khoản',
                style: TextStyle(
                    color: AppColors.textSecondary, fontSize: 16)),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.push('/dang-nhap'),
              style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50)),
              child: const Text('Đăng nhập'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.push('/dang-ky'),
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50)),
              child: const Text('Tạo tài khoản mới'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountView extends ConsumerWidget {
  final dynamic profile;
  const _AccountView({required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        // Profile header
        Container(
          padding: const EdgeInsets.all(20),
          color: AppColors.bgSection,
          child: Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  (profile.nameOrEmail)[0].toUpperCase(),
                  style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 24,
                      fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.nameOrEmail,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 17,
                          fontWeight: FontWeight.w700),
                    ),
                    if (profile.email != null)
                      Text(profile.email!,
                          style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 13)),
                  ],
                ),
              ),
              IconButton(
                onPressed: () =>
                    context.push('/tai-khoan/edit-account'),
                icon: const Icon(Icons.edit_outlined,
                    color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        _MenuItem(
          icon: Icons.shopping_bag_outlined,
          label: 'Đơn hàng của tôi',
          onTap: () => context.push('/tai-khoan/don-hang'),
        ),
        _MenuItem(
          icon: Icons.location_on_outlined,
          label: 'Địa chỉ giao hàng',
          onTap: () => context.push('/tai-khoan/dia-chi'),
        ),
        _MenuItem(
          icon: Icons.swap_horiz,
          label: 'Đổi trả hàng',
          onTap: () => context.push('/tai-khoan/doi-tra'),
        ),
        const Divider(color: AppColors.divider, height: 1),
        _MenuItem(
          icon: Icons.phone_outlined,
          label: 'Liên hệ hỗ trợ',
          onTap: () => context.push('/lien-he'),
        ),
        _MenuItem(
          icon: Icons.policy_outlined,
          label: 'Chính sách',
          onTap: () => context.push('/chinh-sach'),
        ),
        const Divider(color: AppColors.divider, height: 1),
        _MenuItem(
          icon: Icons.logout,
          label: 'Đăng xuất',
          color: AppColors.error,
          onTap: () => _confirmLogout(context, ref),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.bgSection,
        title: const Text('Đăng xuất?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Huỷ')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Đăng xuất',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _MenuItem(
      {required this.icon,
      required this.label,
      required this.onTap,
      this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textPrimary;
    return ListTile(
      leading: Icon(icon, color: c, size: 22),
      title: Text(label,
          style: TextStyle(color: c, fontSize: 15)),
      trailing: color == null
          ? const Icon(Icons.chevron_right,
              color: AppColors.textMuted, size: 20)
          : null,
      onTap: onTap,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
    );
  }
}
