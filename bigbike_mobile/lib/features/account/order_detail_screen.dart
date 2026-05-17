import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/order.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/media_image.dart';
import '../../core/utils/formatters.dart';
import 'create_return_screen.dart';

// Mirrors web's isCustomerCancellable — only UNPAID orders that haven't shipped.
bool _isCancellable(OrderDetail o) {
  if (o.paymentStatus != 'UNPAID') return false;
  if (o.status == 'PENDING' || o.status == 'ON_HOLD') return true;
  if (o.status == 'PROCESSING') {
    return o.fulfillmentStatus != 'SHIPPED' && o.fulfillmentStatus != 'DELIVERED';
  }
  return false;
}

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
                  : _OrderContent(order: _order!, onReload: _load),
    );
  }
}

class _OrderContent extends StatefulWidget {
  final OrderDetail order;
  final VoidCallback onReload;
  const _OrderContent({required this.order, required this.onReload});

  @override
  State<_OrderContent> createState() => _OrderContentState();
}

class _OrderContentState extends State<_OrderContent> {
  bool _showCancelConfirm = false;
  bool _cancelling = false;
  String? _cancelError;
  bool _checkingEligibility = false;

  Future<void> _doCancel() async {
    setState(() { _cancelling = true; _cancelError = null; });
    try {
      await ApiClient().patch<Map<String, dynamic>>(
          ApiEndpoints.cancelOrder(widget.order.id), data: {});
      setState(() { _showCancelConfirm = false; _cancelling = false; });
      widget.onReload();
    } catch (e) {
      setState(() {
        _cancelError = e.toString();
        _cancelling = false;
        _showCancelConfirm = false;
      });
    }
  }

  Future<void> _openReturnWithEligibilityCheck() async {
    setState(() => _checkingEligibility = true);
    bool eligible = true;
    String? reason;
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
          ApiEndpoints.orderReturnEligibility(widget.order.id));
      eligible = data['eligible'] as bool? ?? true;
      reason = data['reason'] as String?;
    } catch (_) {
      // Eligibility endpoint failure: degrade gracefully, allow navigation
    } finally {
      if (mounted) setState(() => _checkingEligibility = false);
    }
    if (!mounted) return;
    if (!eligible) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(reason ?? 'Đơn hàng không đủ điều kiện đổi trả.'),
        backgroundColor: AppColors.error,
      ));
      return;
    }
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CreateReturnScreen(preselectedOrderId: widget.order.id),
      ),
    );
    if (created == true && mounted) widget.onReload();
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
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
          _section('Địa chỉ giao hàng', [
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
              _totalRow('Tạm tính', formatVnd(order.subtotalAmount)),
              if (order.discountAmount > 0)
                _totalRow('Giảm giá', '-${formatVnd(order.discountAmount)}', color: AppColors.success),
              if (order.shippingAmount > 0)
                _totalRow('Phí giao hàng', formatVnd(order.shippingAmount)),
              const Divider(color: AppColors.divider, height: 16),
              _totalRow('Tổng cộng', formatVnd(order.totalAmount),
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

        // Cancel error banner
        if (_cancelError != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
            ),
            child: Text(_cancelError!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        ],

        // Cancel section
        if (_isCancellable(order)) ...[
          const SizedBox(height: 12),
          if (_showCancelConfirm)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Xác nhận huỷ đơn #${order.orderNumber}?',
                      style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 6),
                  const Text(
                    'Đơn hàng sẽ bị huỷ và tồn kho sẽ được hoàn lại. Thao tác không thể khôi phục.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _cancelling ? null : () => setState(() => _showCancelConfirm = false),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.borderSubtle),
                          ),
                          child: const Text('Không huỷ'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _cancelling ? null : _doCancel,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                            disabledBackgroundColor: AppColors.error.withValues(alpha: 0.4),
                          ),
                          child: _cancelling
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Xác nhận huỷ', style: TextStyle(color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            )
          else
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => setState(() { _showCancelConfirm = true; _cancelError = null; }),
                child: const Text('Huỷ đơn hàng', style: TextStyle(color: AppColors.error)),
              ),
            ),
        ],

        // Return section
        if (order.status == 'COMPLETED') ...[
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: _checkingEligibility ? null : _openReturnWithEligibilityCheck,
              icon: _checkingEligibility
                  ? const SizedBox(
                      width: 14, height: 14,
                      child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                  : const Icon(Icons.assignment_return_outlined, size: 16, color: AppColors.primary),
              label: const Text('Yêu cầu đổi trả', style: TextStyle(color: AppColors.primary)),
            ),
          ),
        ],

        const SizedBox(height: 24),
      ],
    );
  }

  Widget _section(String title, List<String> lines) {
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

  Widget _totalRow(String label, String value, {bool bold = false, Color? color}) {
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
