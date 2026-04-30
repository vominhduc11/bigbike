import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/order.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/media_image.dart';
import '../../core/utils/formatters.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  OrderDetail? _order;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
          ApiEndpoints.myOrder(widget.orderId));
      setState(() {
        _order = OrderDetail.fromJson(data);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_order != null ? 'Đơn #${_order!.orderNumber}' : 'Chi tiết đơn hàng'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _order == null
                  ? const EmptyState(message: 'Không tìm thấy đơn hàng')
                  : _OrderContent(order: _order!),
    );
  }
}

class _OrderContent extends StatelessWidget {
  final OrderDetail order;
  const _OrderContent({required this.order});

  @override
  Widget build(BuildContext context) {
    final shipping = order.shippingAddress;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Status
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Trạng thái', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 4),
                StatusBadge.fromOrderStatus(order.status),
              ]),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                const Text('Thanh toán', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Text(paymentStatusLabel(order.paymentStatus),
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
              ]),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Address
        if (shipping != null)
          _Section('Địa chỉ giao hàng', [
            shipping.fullName,
            shipping.phone,
            shipping.fullAddress,
          ]),

        const SizedBox(height: 12),

        // Items
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Sản phẩm', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...order.lineItems.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: MediaImage(src: item.image, width: 52, height: 52, fit: BoxFit.cover),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.productName,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
                              if (item.variantName != null)
                                Text(item.variantName!, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                            ],
                          ),
                        ),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('x${item.quantity}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                          Text(formatVnd(item.lineTotal),
                              style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                        ]),
                      ],
                    ),
                  )),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Totals
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            children: [
              _TotalRow('Tạm tính', formatVnd(order.subtotalAmount)),
              if (order.discountAmount > 0)
                _TotalRow('Giảm giá', '-${formatVnd(order.discountAmount)}', color: AppColors.success),
              if (order.shippingAmount > 0)
                _TotalRow('Phí giao hàng', formatVnd(order.shippingAmount)),
              const Divider(color: AppColors.divider, height: 16),
              _TotalRow('Tổng cộng', formatVnd(order.totalAmount),
                  bold: true, color: AppColors.primary),
            ],
          ),
        ),

        const SizedBox(height: 12),
        if (order.placedAt != null)
          Center(
            child: Text('Đặt lúc ${formatDateTime(order.placedAt)}',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _Section(String title, List<String> lines) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        ...lines.map((l) => Text(l, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14))),
      ]),
    );
  }

  Widget _TotalRow(String label, String value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: bold ? 15 : 13)),
          Text(value, style: TextStyle(color: color ?? AppColors.textPrimary, fontSize: bold ? 16 : 13, fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
        ],
      ),
    );
  }
}
