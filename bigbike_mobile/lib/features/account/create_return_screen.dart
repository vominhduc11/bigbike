import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/theme/app_colors.dart';

const _reasonOptions = [
  ('DEFECTIVE', 'Hàng bị lỗi'),
  ('WRONG_ITEM', 'Sai sản phẩm'),
  ('NOT_AS_DESCRIBED', 'Không như mô tả'),
  ('CHANGED_MIND', 'Đổi ý'),
  ('OTHER', 'Khác'),
];

const _returnableStatuses = {'COMPLETED'};

class CreateReturnScreen extends StatefulWidget {
  /// When opened from order detail, pre-select this orderId.
  final String? preselectedOrderId;
  const CreateReturnScreen({super.key, this.preselectedOrderId});

  @override
  State<CreateReturnScreen> createState() => _CreateReturnScreenState();
}

class _CreateReturnScreenState extends State<CreateReturnScreen> {
  // Orders dropdown
  List<Map<String, dynamic>> _orders = [];
  bool _ordersLoading = true;
  String? _selectedOrderId;

  // Line items
  List<Map<String, dynamic>> _lineItems = [];
  bool _lineItemsLoading = false;
  Map<String, bool> _itemSelected = {};
  Map<String, int> _itemQuantity = {};

  // Form
  String? _selectedReason;
  final _noteController = TextEditingController();

  // Submit
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedOrderId = widget.preselectedOrderId;
    _loadOrders();
    if (widget.preselectedOrderId != null) {
      _handleOrderChanged(widget.preselectedOrderId!);
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() => _ordersLoading = true);
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.myOrders,
        queryParams: {'page': 1, 'size': 50},
      );
      final items = (data['data'] as List? ?? []).cast<Map<String, dynamic>>();
      setState(() {
        _orders = items
            .where((o) => _returnableStatuses.contains(o['status'] as String?))
            .toList();
        _ordersLoading = false;
      });
    } catch (_) {
      setState(() { _orders = []; _ordersLoading = false; });
    }
  }

  Future<void> _handleOrderChanged(String orderId) async {
    setState(() {
      _selectedOrderId = orderId;
      _lineItems = [];
      _itemSelected = {};
      _itemQuantity = {};
      _lineItemsLoading = true;
    });
    try {
      final data = await ApiClient().get<dynamic>(ApiEndpoints.myOrder(orderId));
      final orderMap = data is Map
          ? ((data['data'] as Map<String, dynamic>?) ?? Map<String, dynamic>.from(data))
          : <String, dynamic>{};
      final rawItems = (orderMap['lineItems'] as List?) ?? [];
      final items = rawItems.cast<Map<String, dynamic>>();
      final selected = <String, bool>{};
      final qty = <String, int>{};
      for (final item in items) {
        final id = item['id'] as String? ?? '';
        if (id.isNotEmpty) {
          selected[id] = false;
          qty[id] = 1;
        }
      }
      setState(() {
        _lineItems = items;
        _itemSelected = selected;
        _itemQuantity = qty;
        _lineItemsLoading = false;
      });
    } catch (_) {
      setState(() { _lineItemsLoading = false; });
    }
  }

  Future<void> _submit() async {
    final orderId = _selectedOrderId;
    final reason = _selectedReason;

    if (orderId == null || orderId.isEmpty) {
      setState(() => _error = 'Vui lòng chọn đơn hàng.');
      return;
    }
    if (reason == null) {
      setState(() => _error = 'Vui lòng chọn lý do đổi trả.');
      return;
    }

    final items = _lineItems
        .where((item) => _itemSelected[item['id'] as String? ?? ''] == true)
        .map((item) {
          final id = item['id'] as String? ?? '';
          return {
            'orderLineItemId': id,
            'quantity': _itemQuantity[id] ?? 1,
            'reason': reason,
          };
        })
        .toList();

    if (items.isEmpty) {
      setState(() => _error = 'Vui lòng chọn ít nhất một sản phẩm cần đổi trả.');
      return;
    }

    setState(() { _submitting = true; _error = null; });

    try {
      await ApiClient().post<Map<String, dynamic>>(
        ApiEndpoints.createReturn(orderId),
        data: {
          'reason': reason,
          if (_noteController.text.trim().isNotEmpty)
            'customerNote': _noteController.text.trim(),
          'items': items,
        },
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() { _error = e.toString(); _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool canSubmit = !_submitting && !_ordersLoading && !_lineItemsLoading
        && _selectedOrderId != null && _selectedReason != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Tạo yêu cầu đổi trả')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.error.withOpacity(0.3)),
                ),
                child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
              ),

            // Order picker
            const Text('Đơn hàng', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            _ordersLoading
                ? const SizedBox(height: 48, child: Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2)))
                : _orders.isEmpty
                    ? Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: const Text(
                          'Không có đơn hàng đủ điều kiện đổi trả.\n(Cần đơn có trạng thái Hoàn thành)',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      )
                    : DropdownButtonFormField<String>(
                        value: _orders.any((o) => o['id'] == _selectedOrderId) ? _selectedOrderId : null,
                        decoration: _inputDecoration('Chọn đơn hàng'),
                        items: _orders.map((o) {
                          return DropdownMenuItem<String>(
                            value: o['id'] as String,
                            child: Text('Đơn #${o['orderNumber'] ?? o['id']}'),
                          );
                        }).toList(),
                        onChanged: (v) { if (v != null) _handleOrderChanged(v); },
                      ),

            // Line items picker
            if (_selectedOrderId != null) ...[
              const SizedBox(height: 20),
              const Text('Sản phẩm cần đổi trả', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              if (_lineItemsLoading)
                const SizedBox(height: 48, child: Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2)))
              else if (_lineItems.isEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: const Text('Không tải được sản phẩm.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                )
              else
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: Column(
                    children: _lineItems.asMap().entries.map((entry) {
                      final item = entry.value;
                      final id = item['id'] as String? ?? '';
                      final productName = item['productName'] as String? ?? '';
                      final variantName = item['variantName'] as String?;
                      final maxQty = (item['quantity'] as int?) ?? 1;
                      final isSelected = _itemSelected[id] ?? false;
                      final qty = _itemQuantity[id] ?? 1;
                      final isLast = entry.key == _lineItems.length - 1;

                      return Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            child: Row(
                              children: [
                                Checkbox(
                                  value: isSelected,
                                  activeColor: AppColors.primary,
                                  onChanged: (v) => setState(() => _itemSelected[id] = v ?? false),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(productName, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
                                      if (variantName != null)
                                        Text(variantName, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                                      Text('Đã mua: $maxQty', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove, size: 16),
                                        onPressed: qty > 1 ? () => setState(() => _itemQuantity[id] = qty - 1) : null,
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                      ),
                                      SizedBox(
                                        width: 28,
                                        child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.add, size: 16),
                                        onPressed: qty < maxQty ? () => setState(() => _itemQuantity[id] = qty + 1) : null,
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                          if (!isLast) const Divider(height: 1, color: AppColors.borderSubtle),
                        ],
                      );
                    }).toList(),
                  ),
                ),
            ],

            const SizedBox(height: 20),

            // Reason picker
            const Text('Lý do đổi trả', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              value: _selectedReason,
              decoration: _inputDecoration('Chọn lý do'),
              items: _reasonOptions.map((opt) {
                return DropdownMenuItem<String>(
                  value: opt.$1,
                  child: Text(opt.$2),
                );
              }).toList(),
              onChanged: (v) => setState(() => _selectedReason = v),
            ),

            const SizedBox(height: 20),

            // Note
            const Text('Mô tả thêm (không bắt buộc)', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            TextField(
              controller: _noteController,
              maxLines: 3,
              decoration: _inputDecoration('Mô tả thêm về vấn đề...'),
            ),

            const SizedBox(height: 32),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: canSubmit ? _submit : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  disabledBackgroundColor: AppColors.primary.withOpacity(0.4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Gửi yêu cầu', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textMuted),
      filled: true,
      fillColor: AppColors.bgSurface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.primary),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
