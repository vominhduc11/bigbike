import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/customer.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';
import '../../core/utils/validators.dart';

class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<CustomerAddress>? _addresses;
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
      final data = await ApiClient().get<Map<String, dynamic>>(ApiEndpoints.addresses);
      setState(() {
        _addresses = (data['items'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(CustomerAddress.fromJson)
            .toList();
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
        title: const Text('Địa chỉ giao hàng'),
        actions: [
          IconButton(
            onPressed: () => _showAddressForm(context, null),
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _addresses == null || _addresses!.isEmpty
                  ? EmptyState(
                      message: 'Chưa có địa chỉ',
                      icon: Icons.location_on_outlined,
                      action: ElevatedButton(
                        onPressed: () => _showAddressForm(context, null),
                        child: const Text('Thêm địa chỉ'),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _addresses!.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) => _AddressCard(
                        address: _addresses![i],
                        onEdit: () => _showAddressForm(context, _addresses![i]),
                        onDelete: () => _delete(_addresses![i].id),
                      ),
                    ),
    );
  }

  Future<void> _delete(String id) async {
    try {
      await ApiClient().delete(ApiEndpoints.address(id));
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _showAddressForm(BuildContext context, CustomerAddress? addr) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSection,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _AddressFormSheet(
        address: addr,
        onSaved: () { Navigator.pop(context); _load(); },
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  final CustomerAddress address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _AddressCard({required this.address, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: address.isDefault ? AppColors.primary : AppColors.borderSubtle,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(address.fullName,
                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
              if (address.isDefault) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('Mặc định',
                      style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ],
              const Spacer(),
              IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.textMuted)),
              IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.error)),
            ],
          ),
          const SizedBox(height: 4),
          Text(address.phone, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          Text(address.fullAddress, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
        ],
      ),
    );
  }
}

class _AddressFormSheet extends StatefulWidget {
  final CustomerAddress? address;
  final VoidCallback onSaved;
  const _AddressFormSheet({this.address, required this.onSaved});

  @override
  State<_AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends State<_AddressFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _provinceCtrl;
  late final TextEditingController _districtCtrl;
  late final TextEditingController _wardCtrl;
  late final TextEditingController _addrCtrl;
  bool _isDefault = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final a = widget.address;
    _nameCtrl = TextEditingController(text: a?.fullName ?? '');
    _phoneCtrl = TextEditingController(text: a?.phone ?? '');
    _provinceCtrl = TextEditingController(text: a?.province ?? '');
    _districtCtrl = TextEditingController(text: a?.district ?? '');
    _wardCtrl = TextEditingController(text: a?.ward ?? '');
    _addrCtrl = TextEditingController(text: a?.addressLine1 ?? '');
    _isDefault = a?.isDefault ?? false;
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _phoneCtrl, _provinceCtrl, _districtCtrl, _wardCtrl, _addrCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        builder: (_, scroll) => Form(
          key: _formKey,
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.all(16),
            children: [
              Text(widget.address == null ? 'Thêm địa chỉ' : 'Sửa địa chỉ',
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              _field(_nameCtrl, 'Họ tên', validator: (v) => Validators.required(v, 'Họ tên')),
              const SizedBox(height: 12),
              _field(_phoneCtrl, 'Số điện thoại', validator: Validators.phone, keyboardType: TextInputType.phone),
              const SizedBox(height: 12),
              _field(_provinceCtrl, 'Tỉnh / Thành phố', validator: (v) => Validators.required(v, 'Tỉnh/Thành')),
              const SizedBox(height: 12),
              _field(_districtCtrl, 'Quận / Huyện', validator: (v) => Validators.required(v, 'Quận/Huyện')),
              const SizedBox(height: 12),
              _field(_wardCtrl, 'Phường / Xã', validator: (v) => Validators.required(v, 'Phường/Xã')),
              const SizedBox(height: 12),
              _field(_addrCtrl, 'Địa chỉ chi tiết', validator: (v) => Validators.required(v, 'Địa chỉ')),
              const SizedBox(height: 12),
              SwitchListTile(
                value: _isDefault,
                onChanged: (v) => setState(() => _isDefault = v),
                title: const Text('Đặt làm địa chỉ mặc định', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loading ? null : _save,
                style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: _loading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Lưu địa chỉ'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController ctrl, String label,
      {String? Function(String?)? validator, TextInputType? keyboardType}) =>
      TextFormField(
        controller: ctrl,
        validator: validator,
        keyboardType: keyboardType,
        style: const TextStyle(color: AppColors.textPrimary),
        decoration: InputDecoration(labelText: label),
      );

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final payload = CustomerAddress(
        id: widget.address?.id ?? '',
        type: 'shipping',
        fullName: _nameCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        province: _provinceCtrl.text.trim(),
        district: _districtCtrl.text.trim(),
        ward: _wardCtrl.text.trim(),
        addressLine1: _addrCtrl.text.trim(),
        isDefault: _isDefault,
      ).toJson();

      if (widget.address == null) {
        await ApiClient().post(ApiEndpoints.addresses, data: payload);
      } else {
        await ApiClient().patch(ApiEndpoints.address(widget.address!.id), data: payload);
      }
      widget.onSaved();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}
