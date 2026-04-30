import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/cart.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/widgets/media_image.dart';
import '../../core/widgets/error_view.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  final _couponCtrl = TextEditingController();
  bool _applyingCoupon = false;

  @override
  void dispose() {
    _couponCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Giỏ hàng'),
        actions: [
          if (cartAsync.valueOrNull?.isEmpty == false)
            TextButton(
              onPressed: () => _confirmClear(context),
              child: const Text('Xoá tất cả',
                  style: TextStyle(color: AppColors.error)),
            ),
        ],
      ),
      body: cartAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                color: AppColors.primary)),
        error: (e, _) => ErrorView(
          message: 'Không tải được giỏ hàng',
          onRetry: () => ref.refresh(cartProvider),
        ),
        data: (cart) => cart.isEmpty
            ? EmptyCartView(
                onShop: () => context.go('/san-pham'))
            : _CartBody(
                cart: cart,
                couponCtrl: _couponCtrl,
                applyingCoupon: _applyingCoupon,
                onApplyCoupon: _applyCoupon,
                onRemoveCoupon: _removeCoupon,
                onCheckout: () => _checkout(context, cart),
              ),
      ),
    );
  }

  Future<void> _applyCoupon() async {
    final code = _couponCtrl.text.trim();
    if (code.isEmpty) return;
    setState(() => _applyingCoupon = true);
    try {
      await ref.read(cartProvider.notifier).applyCoupon(code);
      _couponCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Áp dụng mã giảm giá thành công'),
              backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Mã không hợp lệ: $e'),
              backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _applyingCoupon = false);
    }
  }

  Future<void> _removeCoupon(String code) async {
    await ref.read(cartProvider.notifier).removeCoupon(code);
  }

  void _checkout(BuildContext context, Cart cart) {
    final auth = ref.read(authProvider).valueOrNull;
    if (auth?.isAuthenticated != true) {
      context.push('/dang-nhap?redirect=/thanh-toan');
      return;
    }
    context.push('/thanh-toan');
  }

  void _confirmClear(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.bgSection,
        title: const Text('Xoá giỏ hàng?'),
        content: const Text(
            'Tất cả sản phẩm sẽ bị xoá khỏi giỏ hàng.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Huỷ')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(cartProvider.notifier).clear();
            },
            child: const Text('Xoá',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}

class _CartBody extends ConsumerWidget {
  final Cart cart;
  final TextEditingController couponCtrl;
  final bool applyingCoupon;
  final VoidCallback onApplyCoupon;
  final void Function(String) onRemoveCoupon;
  final VoidCallback onCheckout;

  const _CartBody({
    required this.cart,
    required this.couponCtrl,
    required this.applyingCoupon,
    required this.onApplyCoupon,
    required this.onRemoveCoupon,
    required this.onCheckout,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...cart.items.map((item) => _CartItemCard(item: item)),
              const SizedBox(height: 16),
              _CouponSection(
                codes: cart.couponCodes,
                ctrl: couponCtrl,
                applying: applyingCoupon,
                onApply: onApplyCoupon,
                onRemove: onRemoveCoupon,
              ),
              const SizedBox(height: 16),
              _CartTotalsWidget(totals: cart.totals),
            ],
          ),
        ),
        _CheckoutBar(
            total: cart.totals.totalAmount,
            onCheckout: onCheckout),
      ],
    );
  }
}

class _CartItemCard extends ConsumerWidget {
  final CartItem item;
  const _CartItemCard({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: MediaImage(
                src: item.image, width: 70, height: 70,
                fit: BoxFit.cover),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.productName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w500,
                        fontSize: 13)),
                if (item.variantName != null)
                  Text(item.variantName!,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Text(formatVnd(item.lineTotal),
                    style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14)),
              ],
            ),
          ),
          Column(
            children: [
              IconButton(
                onPressed: () => ref
                    .read(cartProvider.notifier)
                    .removeItem(item.id),
                icon: const Icon(Icons.delete_outline,
                    color: AppColors.error, size: 20),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: item.quantity > 1
                        ? () => ref
                            .read(cartProvider.notifier)
                            .updateItem(item.id, item.quantity - 1)
                        : null,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.bgSurfaceRaised,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Icon(Icons.remove, size: 14,
                          color: AppColors.textPrimary),
                    ),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8),
                    child: Text('${item.quantity}',
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600)),
                  ),
                  GestureDetector(
                    onTap: () => ref
                        .read(cartProvider.notifier)
                        .updateItem(item.id, item.quantity + 1),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.bgSurfaceRaised,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Icon(Icons.add, size: 14,
                          color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CouponSection extends StatelessWidget {
  final List<String> codes;
  final TextEditingController ctrl;
  final bool applying;
  final VoidCallback onApply;
  final void Function(String) onRemove;

  const _CouponSection({
    required this.codes,
    required this.ctrl,
    required this.applying,
    required this.onApply,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: ctrl,
                style: const TextStyle(
                    color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  hintText: 'Nhập mã giảm giá',
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: applying ? null : onApply,
              child: applying
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white))
                  : const Text('Áp dụng'),
            ),
          ],
        ),
        ...codes.map((code) => Chip(
              label: Text(code,
                  style: const TextStyle(
                      color: AppColors.textPrimary)),
              deleteIcon: const Icon(Icons.close, size: 14,
                  color: AppColors.textMuted),
              onDeleted: () => onRemove(code),
              backgroundColor: AppColors.bgSurfaceRaised,
            )),
      ],
    );
  }
}

class _CartTotalsWidget extends StatelessWidget {
  final CartTotals totals;
  const _CartTotalsWidget({required this.totals});

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
          _Row('Tạm tính', formatVnd(totals.subtotalAmount)),
          if (totals.discountAmount > 0)
            _Row('Giảm giá',
                '-${formatVnd(totals.discountAmount)}',
                color: AppColors.success),
          if (totals.shippingAmount > 0)
            _Row('Phí giao hàng',
                formatVnd(totals.shippingAmount)),
          const Divider(color: AppColors.divider, height: 16),
          _Row('Tổng cộng', formatVnd(totals.totalAmount),
              isBold: true, color: AppColors.primary),
        ],
      ),
    );
  }

  Widget _Row(String label, String value,
      {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: isBold ? 15 : 14,
                  fontWeight: isBold
                      ? FontWeight.w700
                      : FontWeight.normal)),
          Text(value,
              style: TextStyle(
                  color: color ?? AppColors.textPrimary,
                  fontSize: isBold ? 16 : 14,
                  fontWeight: isBold
                      ? FontWeight.w700
                      : FontWeight.normal)),
        ],
      ),
    );
  }
}

class _CheckoutBar extends StatelessWidget {
  final double total;
  final VoidCallback onCheckout;
  const _CheckoutBar(
      {required this.total, required this.onCheckout});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: AppColors.bgSection,
        border:
            Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Tổng',
                  style: TextStyle(
                      color: AppColors.textMuted, fontSize: 12)),
              Text(formatVnd(total),
                  style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: ElevatedButton(
              onPressed: onCheckout,
              child: const Text('Thanh toán'),
            ),
          ),
        ],
      ),
    );
  }
}

class EmptyCartView extends StatelessWidget {
  final VoidCallback onShop;
  const EmptyCartView({super.key, required this.onShop});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.shopping_cart_outlined,
              color: AppColors.textMuted, size: 64),
          const SizedBox(height: 16),
          const Text('Giỏ hàng trống',
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 16)),
          const SizedBox(height: 8),
          const Text('Hãy thêm sản phẩm vào giỏ',
              style: TextStyle(
                  color: AppColors.textMuted, fontSize: 14)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onShop,
            icon: const Icon(Icons.shopping_bag_outlined),
            label: const Text('Mua sắm ngay'),
          ),
        ],
      ),
    );
  }
}
