import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_colors.dart';

class AppShell extends ConsumerWidget {
  final StatefulNavigationShell shell;
  const AppShell({super.key, required this.shell});

  static const _tabs = [
    _Tab(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Trang chủ'),
    _Tab(icon: Icons.grid_view_outlined, activeIcon: Icons.grid_view, label: 'Sản phẩm'),
    _Tab(icon: Icons.shopping_cart_outlined, activeIcon: Icons.shopping_cart, label: 'Giỏ hàng'),
    _Tab(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Tài khoản'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(cartCountProvider);

    return Scaffold(
      body: shell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.borderSubtle),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: shell.currentIndex,
          onTap: (i) => shell.goBranch(
            i,
            initialLocation: i == shell.currentIndex,
          ),
          items: List.generate(_tabs.length, (i) {
            final tab = _tabs[i];
            final isCart = i == 2;
            return BottomNavigationBarItem(
              icon: isCart && cartCount > 0
                  ? Badge(
                      label: Text(
                        cartCount > 99 ? '99+' : '$cartCount',
                        style: const TextStyle(fontSize: 10),
                      ),
                      child: Icon(tab.icon),
                    )
                  : Icon(tab.icon),
              activeIcon: isCart && cartCount > 0
                  ? Badge(
                      label: Text(
                        cartCount > 99 ? '99+' : '$cartCount',
                        style: const TextStyle(fontSize: 10),
                      ),
                      child: Icon(tab.activeIcon),
                    )
                  : Icon(tab.activeIcon),
              label: tab.label,
            );
          }),
        ),
      ),
    );
  }
}

class _Tab {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _Tab(
      {required this.icon,
      required this.activeIcon,
      required this.label});
}
