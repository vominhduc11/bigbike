import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/models/warranty.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/status_badge.dart';
import 'warranty_service.dart';

/// Public warranty lookup — mobile counterpart of the web `/bao-hanh` page.
class WarrantyLookupScreen extends StatefulWidget {
  const WarrantyLookupScreen({super.key});

  @override
  State<WarrantyLookupScreen> createState() => _WarrantyLookupScreenState();
}

enum _Phase { idle, loading, error, notFound, result }

class _WarrantyLookupScreenState extends State<WarrantyLookupScreen> {
  final _service = WarrantyService();
  final _controller = TextEditingController();

  _Phase _phase = _Phase.idle;
  String _errorMessage = '';
  String _lastQuery = '';
  WarrantyLookupResult? _result;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _controller.text.trim().isNotEmpty && _phase != _Phase.loading;

  Future<void> _submit() async {
    final serial = _controller.text.trim();
    // Guard against empty input and double-taps while a request is in flight.
    if (serial.isEmpty || _phase == _Phase.loading) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _phase = _Phase.loading;
      _lastQuery = serial;
      _result = null;
    });

    try {
      final result = await _service.lookupWarranty(serial);
      if (!mounted) return;
      setState(() {
        _result = result;
        _phase = _Phase.result;
      });
    } catch (e) {
      if (!mounted) return;
      final ex = extractApiException(e);
      setState(() {
        if (ex.isNotFound) {
          _phase = _Phase.notFound;
        } else {
          _phase = _Phase.error;
          _errorMessage = ex.displayMessage;
        }
      });
    }
  }

  void _retry() {
    if (_lastQuery.isEmpty) return;
    _controller.text = _lastQuery;
    _submit();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tra cứu bảo hành')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Nhập số serial in trên sản phẩm hoặc phiếu bảo hành để kiểm tra '
            'thời hạn bảo hành.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            textInputAction: TextInputAction.search,
            textCapitalization: TextCapitalization.characters,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) {
              if (_canSubmit) _submit();
            },
            decoration: const InputDecoration(
              labelText: 'Số serial',
              hintText: 'Ví dụ: SN-A1B2C3D4E5F6',
              prefixIcon: Icon(Icons.qr_code_2_outlined),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _canSubmit ? _submit : null,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: _phase == _Phase.loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Tra cứu'),
            ),
          ),
          const SizedBox(height: 20),
          _buildBody(),
        ],
      ),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _Phase.idle:
        return const SizedBox.shrink();
      case _Phase.loading:
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: 40),
          child: Center(
              child: CircularProgressIndicator(color: AppColors.primary)),
        );
      case _Phase.notFound:
        return const EmptyState(
          message:
              'Không tìm thấy bảo hành cho số serial này. Vui lòng kiểm tra '
              'lại số serial.',
          icon: Icons.search_off_outlined,
        );
      case _Phase.error:
        return ErrorView(message: _errorMessage, onRetry: _retry);
      case _Phase.result:
        return _WarrantyResultCard(result: _result!);
    }
  }
}

/// Maps a warranty status to a localized badge. Unknown statuses fall back to
/// a neutral badge so the UI never breaks on an unexpected value.
StatusBadge _statusBadge(String status) {
  final (label, color) = switch (status.toUpperCase()) {
    'ACTIVE' => ('Còn bảo hành', AppColors.success),
    'EXPIRED' => ('Hết hạn', AppColors.warning),
    'VOIDED' => ('Đã hủy bảo hành', AppColors.error),
    _ => (status.isEmpty ? 'Không xác định' : status, AppColors.textMuted),
  };
  return StatusBadge(label: label, color: color, fontSize: 12);
}

/// Formats an ISO date string (yyyy-MM-dd) as dd/MM/yyyy; returns the raw
/// value if it cannot be parsed.
String _formatDate(String iso) {
  if (iso.isEmpty) return '—';
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(parsed.day)}/${two(parsed.month)}/${parsed.year}';
}

class _WarrantyResultCard extends StatelessWidget {
  final WarrantyLookupResult result;
  const _WarrantyResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final isActive = result.status.toUpperCase() == 'ACTIVE';
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Kết quả tra cứu',
                  style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
              _statusBadge(result.status),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            result.productName.isEmpty ? 'Sản phẩm' : result.productName,
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text('Serial: ${result.serialNumber}',
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 13)),
          const Divider(color: AppColors.divider, height: 24),
          _Row(label: 'Bắt đầu', value: _formatDate(result.startDate)),
          _Row(label: 'Kết thúc', value: _formatDate(result.endDate)),
          _Row(
            label: 'Số ngày còn lại',
            value: isActive ? '${result.daysLeft} ngày' : '—',
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
