import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/order.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/status_badge.dart';

class OrderConfirmationScreen extends StatefulWidget {
  final String orderNumber;
  final String orderKey;
  const OrderConfirmationScreen(
      {super.key, required this.orderNumber, required this.orderKey});

  @override
  State<OrderConfirmationScreen> createState() =>
      _OrderConfirmationScreenState();
}

class _OrderConfirmationScreenState
    extends State<OrderConfirmationScreen> {
  OrderDetail? _order;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.orderLookup,
        queryParams: {
          'orderNumber': widget.orderNumber,
          'orderKey': widget.orderKey,
        },
      );
      setState(() {
        _order = OrderDetail.fromJson(data);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(
                    color: AppColors.primary))
            : SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const SizedBox(height: 32),
                    Container(
                      width: 80,
                      height: 80,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primarySoft,
                      ),
                      child: const Icon(Icons.check_circle,
                          color: AppColors.primary, size: 48),
                    ),
                    const SizedBox(height: 16),
                    const Text('Đặt hàng thành công!',
                        style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 22,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(
                      'Mã đơn hàng: ${widget.orderNumber}',
                      style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14),
                    ),
                    const SizedBox(height: 32),
                    if (_order != null) ...[
                      _OrderSummaryCard(order: _order!),
                      const SizedBox(height: 16),
                    ],
                    const Text(
                      'Chúng tôi sẽ liên hệ xác nhận đơn hàng sớm nhất. Cảm ơn bạn đã tin tưởng BigBike!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                          height: 1.6),
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: () => context.go('/'),
                      style: ElevatedButton.styleFrom(
                          minimumSize: const Size.fromHeight(50)),
                      child: const Text('Về trang chủ'),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () =>
                          context.go('/tai-khoan/don-hang'),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(50)),
                      child: const Text('Xem đơn hàng của tôi'),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _OrderSummaryCard extends StatelessWidget {
  final OrderDetail order;
  const _OrderSummaryCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Đơn hàng #${order.orderNumber}',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700)),
              StatusBadge.fromOrderStatus(order.status),
            ],
          ),
          const Divider(color: AppColors.divider, height: 16),
          ...order.lineItems.map((item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${item.productName} x${item.quantity}',
                        style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13),
                      ),
                    ),
                    Text(formatVnd(item.lineTotal),
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 13)),
                  ],
                ),
              )),
          const Divider(color: AppColors.divider, height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tổng',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700)),
              Text(formatVnd(order.totalAmount),
                  style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                      fontSize: 16)),
            ],
          ),
          if (order.placedAt != null) ...[
            const SizedBox(height: 8),
            Text('Đặt lúc: ${formatDateTime(order.placedAt)}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}
