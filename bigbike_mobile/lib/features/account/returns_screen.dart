import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';
import '../../core/utils/formatters.dart';
import 'create_return_screen.dart';

const _statusLabels = {
  'PENDING': 'Chờ duyệt',
  'APPROVED': 'Đã duyệt',
  'REJECTED': 'Từ chối',
  'RECEIVED': 'Đã nhận hàng',
  'COMPLETED': 'Hoàn thành',
  'REFUNDED': 'Đã hoàn tiền',
};

const _reasonLabels = {
  'DEFECTIVE': 'Hàng bị lỗi',
  'WRONG_ITEM': 'Sai sản phẩm',
  'NOT_AS_DESCRIBED': 'Không như mô tả',
  'CHANGED_MIND': 'Đổi ý',
  'OTHER': 'Khác',
};

Color _statusColor(String status) {
  switch (status) {
    case 'APPROVED':
    case 'RECEIVED':
      return AppColors.warning;
    case 'COMPLETED':
    case 'REFUNDED':
      return AppColors.success;
    case 'REJECTED':
      return AppColors.error;
    default:
      return AppColors.textMuted;
  }
}

class ReturnsScreen extends StatefulWidget {
  const ReturnsScreen({super.key});

  @override
  State<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends State<ReturnsScreen> {
  List<Map<String, dynamic>>? _returns;
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
      final data = await ApiClient().get<dynamic>(ApiEndpoints.myReturns);
      final rawList = data is List
          ? data
          : (data is Map ? (data['data'] as List? ?? []) : <dynamic>[]);
      setState(() {
        _returns = rawList.whereType<Map<String, dynamic>>().toList();
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _openCreate() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const CreateReturnScreen()),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đổi trả hàng'),
        actions: [
          TextButton(
            onPressed: _openCreate,
            child: const Text('Tạo mới', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _returns == null || _returns!.isEmpty
                  ? const EmptyState(
                      message: 'Chưa có yêu cầu đổi trả nào',
                      icon: Icons.swap_horiz_outlined)
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _returns!.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) => _ReturnCard(
                        data: _returns![i],
                        onTap: () => _openDetail(_returns![i]),
                      ),
                    ),
    );
  }

  Future<void> _openDetail(Map<String, dynamic> summary) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReturnDetailScreen(
          returnId: summary['id'] as String,
          returnNumber: summary['returnNumber'] as String? ?? '',
        ),
      ),
    );
  }
}

class _ReturnCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback onTap;
  const _ReturnCard({required this.data, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = data['status'] as String? ?? '';
    final reason = data['reason'] as String? ?? '';
    final refundAmount = (data['refundAmount'] as num?)?.toDouble() ?? 0.0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  data['returnNumber'] as String? ?? 'RMA',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'monospace',
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(status).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _statusLabels[status] ?? status,
                    style: TextStyle(
                      color: _statusColor(status),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (data['orderNumber'] != null)
              Text(
                'Đơn #${data['orderNumber']}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
            if (reason.isNotEmpty)
              Text(
                'Lý do: ${_reasonLabels[reason] ?? reason}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            if (refundAmount > 0)
              Text(
                'Hoàn tiền: ${formatVnd(refundAmount)}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            if (data['createdAt'] != null)
              Text(
                formatDate(data['createdAt'] as String?),
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
          ],
        ),
      ),
    );
  }
}

class ReturnDetailScreen extends StatefulWidget {
  final String returnId;
  final String returnNumber;
  const ReturnDetailScreen({super.key, required this.returnId, required this.returnNumber});

  @override
  State<ReturnDetailScreen> createState() => _ReturnDetailScreenState();
}

class _ReturnDetailScreenState extends State<ReturnDetailScreen> {
  Map<String, dynamic>? _detail;
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
      final resp = await ApiClient().get<Map<String, dynamic>>(
          ApiEndpoints.myReturn(widget.returnId));
      // clientRequest returns {data: ...}
      setState(() {
        _detail = (resp['data'] as Map<String, dynamic>?) ?? resp;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.returnNumber.isEmpty ? 'Chi tiết đổi trả' : widget.returnNumber)),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _detail == null
                  ? const EmptyState(message: 'Không tải được chi tiết')
                  : _buildDetail(_detail!),
    );
  }

  Widget _buildDetail(Map<String, dynamic> d) {
    final status = d['status'] as String? ?? '';
    final reason = d['reason'] as String? ?? '';
    final refundAmount = (d['refundAmount'] as num?)?.toDouble() ?? 0.0;
    final items = (d['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final history = (d['history'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final adminNote = d['adminNote'] as String?;
    final customerNote = d['customerNote'] as String?;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Meta card
        _SectionCard(children: [
          _MetaRow('Mã yêu cầu', d['returnNumber'] as String? ?? ''),
          if (d['orderNumber'] != null) _MetaRow('Đơn hàng', '#${d['orderNumber']}'),
          _MetaRow('Lý do', _reasonLabels[reason] ?? reason),
          _MetaRow('Trạng thái', _statusLabels[status] ?? status, valueColor: _statusColor(status)),
          if (refundAmount > 0) _MetaRow('Hoàn tiền', formatVnd(refundAmount)),
          _MetaRow('Ngày tạo', formatDate(d['createdAt'] as String?)),
        ]),
        const SizedBox(height: 12),

        // Customer note
        if (customerNote != null && customerNote.isNotEmpty) ...[
          _NoteCard(label: 'Ghi chú của bạn', content: customerNote, color: AppColors.bgSurface),
          const SizedBox(height: 12),
        ],

        // Admin note
        if (adminNote != null && adminNote.isNotEmpty) ...[
          _NoteCard(label: 'Phản hồi cửa hàng', content: adminNote, color: AppColors.warning.withOpacity(0.08), labelColor: AppColors.warning),
          const SizedBox(height: 12),
        ],

        // Items
        if (items.isNotEmpty) ...[
          _SectionCard(title: 'Sản phẩm đổi trả', children: items.map((item) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item['productName'] as String? ?? '', style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
                        if (item['variantName'] != null)
                          Text(item['variantName'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('SL: ${item['quantity'] ?? 1}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      Text(formatVnd((item['unitPrice'] as num?)?.toDouble() ?? 0), style: const TextStyle(color: AppColors.textPrimary, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            );
          }).toList()),
          const SizedBox(height: 12),
        ],

        // History
        if (history.isNotEmpty) ...[
          _SectionCard(title: 'Lịch sử xử lý', children: history.asMap().entries.map((entry) {
            final h = entry.value;
            final from = h['fromStatus'] as String?;
            final to = h['toStatus'] as String? ?? '';
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      Container(
                        width: 10, height: 10,
                        decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                      ),
                      if (entry.key < history.length - 1)
                        Container(width: 1, height: 30, color: AppColors.borderSubtle),
                    ],
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          from != null
                              ? '${_statusLabels[from] ?? from} → ${_statusLabels[to] ?? to}'
                              : (_statusLabels[to] ?? to),
                          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                        Text(formatDate(h['createdAt'] as String?), style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                        if (h['note'] != null && (h['note'] as String).isNotEmpty)
                          Text(h['note'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontStyle: FontStyle.italic)),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }).toList()),
        ],
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String? title;
  final List<Widget> children;
  const _SectionCard({this.title, required this.children});

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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
            const SizedBox(height: 10),
          ],
          ...children,
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _MetaRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          Text(value, style: TextStyle(color: valueColor ?? AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final String label;
  final String content;
  final Color color;
  final Color? labelColor;
  const _NoteCard({required this.label, required this.content, required this.color, this.labelColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: labelColor ?? AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 4),
          Text(content, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}
