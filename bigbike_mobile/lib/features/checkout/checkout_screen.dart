import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/checkout.dart';
import '../../core/models/cart.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/error_view.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() =>
      _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  int _step = 0;
  bool _loading = false;
  CheckoutOptions? _options;

  // Address form
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _wardCtrl = TextEditingController();
  final _districtCtrl = TextEditingController();
  final _provinceCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();

  String? _shippingCode;
  String? _paymentCode;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    for (final c in [
      _nameCtrl, _phoneCtrl, _emailCtrl, _addressCtrl,
      _wardCtrl, _districtCtrl, _provinceCtrl, _noteCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
          ApiEndpoints.checkoutOptions);
      setState(() {
        _options = CheckoutOptions.fromJson(data);
        if (_options!.shippingMethods.isNotEmpty) {
          _shippingCode = _options!.shippingMethods.first.code;
        }
        if (_options!.paymentMethods.isNotEmpty) {
          _paymentCode = _options!.paymentMethods.first.code;
        }
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(['Địa chỉ', 'Giao hàng & Thanh toán',
            'Xác nhận'][_step]),
      ),
      body: cartAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                color: AppColors.primary)),
        error: (e, _) => ErrorView(message: e.toString()),
        data: (cart) => Column(
          children: [
            _StepIndicator(currentStep: _step),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: _step == 0
                    ? _AddressStep(
                        formKey: _formKey,
                        nameCtrl: _nameCtrl,
                        phoneCtrl: _phoneCtrl,
                        emailCtrl: _emailCtrl,
                        addressCtrl: _addressCtrl,
                        wardCtrl: _wardCtrl,
                        districtCtrl: _districtCtrl,
                        provinceCtrl: _provinceCtrl,
                      )
                    : _step == 1
                        ? _ShippingPaymentStep(
                            options: _options,
                            shippingCode: _shippingCode,
                            paymentCode: _paymentCode,
                            noteCtrl: _noteCtrl,
                            onShippingChanged: (v) =>
                                setState(() => _shippingCode = v),
                            onPaymentChanged: (v) =>
                                setState(() => _paymentCode = v),
                          )
                        : _ReviewStep(
                            cart: cart,
                            name: _nameCtrl.text,
                            phone: _phoneCtrl.text,
                            address: _addressCtrl.text,
                            district: _districtCtrl.text,
                            province: _provinceCtrl.text,
                            shippingCode: _shippingCode,
                            paymentCode: _paymentCode,
                            options: _options,
                          ),
              ),
            ),
            _StepActions(
              step: _step,
              loading: _loading,
              onBack: _step > 0
                  ? () => setState(() => _step--)
                  : null,
              onNext: () => _handleNext(context, cart),
            ),
          ],
        ),
      ),
    );
  }

  void _handleNext(BuildContext context, Cart cart) async {
    if (_step == 0) {
      if (!_formKey.currentState!.validate()) return;
      setState(() => _step = 1);
    } else if (_step == 1) {
      if (_shippingCode == null || _paymentCode == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Vui lòng chọn phương thức giao hàng và thanh toán')),
        );
        return;
      }
      setState(() => _step = 2);
    } else {
      await _submitOrder(context);
    }
  }

  Future<void> _submitOrder(BuildContext context) async {
    setState(() => _loading = true);
    try {
      final address = CheckoutAddress(
        fullName: _nameCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        email: _emailCtrl.text.trim(),
        province: _provinceCtrl.text.trim(),
        district: _districtCtrl.text.trim(),
        ward: _wardCtrl.text.trim(),
        addressLine1: _addressCtrl.text.trim(),
      );
      final payload = CheckoutPayload(
        shippingAddress: address,
        shippingMethodCode: _shippingCode!,
        paymentMethodCode: _paymentCode!,
        notes: _noteCtrl.text.trim().isEmpty
            ? null
            : _noteCtrl.text.trim(),
      );
      final data = await ApiClient().post<Map<String, dynamic>>(
        ApiEndpoints.checkout,
        data: payload.toJson(),
      );
      final confirmation = OrderConfirmation.fromJson(data);
      await ref.read(cartProvider.notifier).refresh();
      if (mounted) {
        context.go(
            '/don-hang/xac-nhan?orderNumber=${confirmation.orderNumber}&orderKey=${confirmation.orderKey}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Lỗi đặt hàng: $e'),
              backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _StepIndicator extends StatelessWidget {
  final int currentStep;
  const _StepIndicator({required this.currentStep});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.bgSection,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: List.generate(3, (i) {
          final done = i < currentStep;
          final active = i == currentStep;
          return Expanded(
            child: Row(
              children: [
                if (i > 0)
                  Expanded(
                    child: Container(
                      height: 1,
                      color: done
                          ? AppColors.primary
                          : AppColors.borderSubtle,
                    ),
                  ),
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: done || active
                        ? AppColors.primary
                        : AppColors.bgSurfaceRaised,
                    border: Border.all(
                      color: active
                          ? AppColors.primary
                          : AppColors.borderSubtle,
                    ),
                  ),
                  child: Center(
                    child: done
                        ? const Icon(Icons.check, size: 14,
                            color: Colors.white)
                        : Text('${i + 1}',
                            style: TextStyle(
                              color: active
                                  ? Colors.white
                                  : AppColors.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            )),
                  ),
                ),
                if (i < 2)
                  Expanded(
                    child: Container(
                      height: 1,
                      color: i < currentStep
                          ? AppColors.primary
                          : AppColors.borderSubtle,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _AddressStep extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl, phoneCtrl, emailCtrl,
      addressCtrl, wardCtrl, districtCtrl, provinceCtrl;

  const _AddressStep({
    required this.formKey,
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.emailCtrl,
    required this.addressCtrl,
    required this.wardCtrl,
    required this.districtCtrl,
    required this.provinceCtrl,
  });

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        children: [
          _Field(ctrl: nameCtrl, label: 'Họ tên', validator: (v) => Validators.required(v, 'Họ tên')),
          const SizedBox(height: 12),
          _Field(ctrl: phoneCtrl, label: 'Số điện thoại', validator: Validators.phone, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          _Field(ctrl: emailCtrl, label: 'Email', validator: Validators.email, keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _Field(ctrl: provinceCtrl, label: 'Tỉnh / Thành phố', validator: (v) => Validators.required(v, 'Tỉnh/Thành')),
          const SizedBox(height: 12),
          _Field(ctrl: districtCtrl, label: 'Quận / Huyện', validator: (v) => Validators.required(v, 'Quận/Huyện')),
          const SizedBox(height: 12),
          _Field(ctrl: wardCtrl, label: 'Phường / Xã', validator: (v) => Validators.required(v, 'Phường/Xã')),
          const SizedBox(height: 12),
          _Field(ctrl: addressCtrl, label: 'Địa chỉ chi tiết', validator: (v) => Validators.required(v, 'Địa chỉ')),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController ctrl;
  final String label;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;

  const _Field({required this.ctrl, required this.label, this.validator, this.keyboardType});

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: ctrl,
        validator: validator,
        keyboardType: keyboardType,
        style: const TextStyle(color: AppColors.textPrimary),
        decoration: InputDecoration(labelText: label),
      );
}

class _ShippingPaymentStep extends StatelessWidget {
  final CheckoutOptions? options;
  final String? shippingCode;
  final String? paymentCode;
  final TextEditingController noteCtrl;
  final void Function(String?) onShippingChanged;
  final void Function(String?) onPaymentChanged;

  const _ShippingPaymentStep({
    required this.options,
    required this.shippingCode,
    required this.paymentCode,
    required this.noteCtrl,
    required this.onShippingChanged,
    required this.onPaymentChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phương thức giao hàng',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 15)),
        const SizedBox(height: 8),
        if (options == null)
          const Center(
              child: CircularProgressIndicator(
                  color: AppColors.primary))
        else
          ...options!.shippingMethods.map((m) => RadioListTile<String>(
                value: m.code,
                groupValue: shippingCode,
                onChanged: onShippingChanged,
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
                title: Text(m.title,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14)),
                subtitle: m.cost > 0
                    ? Text(formatVnd(m.cost),
                        style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13))
                    : const Text('Miễn phí',
                        style: TextStyle(
                            color: AppColors.success,
                            fontSize: 13)),
              )),
        const SizedBox(height: 16),
        const Text('Phương thức thanh toán',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 15)),
        const SizedBox(height: 8),
        if (options != null)
          ...options!.paymentMethods.map((m) => RadioListTile<String>(
                value: m.code,
                groupValue: paymentCode,
                onChanged: onPaymentChanged,
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
                title: Text(m.title,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14)),
                subtitle: m.description != null
                    ? Text(m.description!,
                        style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12))
                    : null,
              )),
        const SizedBox(height: 16),
        TextField(
          controller: noteCtrl,
          maxLines: 3,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: const InputDecoration(
            labelText: 'Ghi chú đơn hàng (tuỳ chọn)',
            alignLabelWithHint: true,
          ),
        ),
      ],
    );
  }
}

class _ReviewStep extends StatelessWidget {
  final Cart cart;
  final String name, phone, address, district, province;
  final String? shippingCode, paymentCode;
  final CheckoutOptions? options;

  const _ReviewStep({
    required this.cart,
    required this.name,
    required this.phone,
    required this.address,
    required this.district,
    required this.province,
    required this.shippingCode,
    required this.paymentCode,
    required this.options,
  });

  @override
  Widget build(BuildContext context) {
    final shipping = options?.shippingMethods
        .where((m) => m.code == shippingCode)
        .firstOrNull;
    final payment = options?.paymentMethods
        .where((m) => m.code == paymentCode)
        .firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Section('Địa chỉ giao hàng', [
          '$name • $phone',
          '$address, $district, $province',
        ]),
        const SizedBox(height: 12),
        _Section('Phương thức', [
          'Giao hàng: ${shipping?.title ?? '—'}',
          'Thanh toán: ${payment?.title ?? '—'}',
        ]),
        const SizedBox(height: 12),
        const Text('Sản phẩm',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        ...cart.items.map((item) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${item.productName}${item.variantName != null ? ' (${item.variantName})' : ''} x${item.quantity}',
                      style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13),
                    ),
                  ),
                  Text(formatVnd(item.lineTotal),
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            )),
        const Divider(color: AppColors.divider, height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Tổng cộng',
                style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16)),
            Text(formatVnd(cart.totals.totalAmount),
                style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 18)),
          ],
        ),
      ],
    );
  }

  Widget _Section(String title, List<String> lines) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          ...lines.map((l) => Text(l,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 14))),
        ],
      ),
    );
  }
}

class _StepActions extends StatelessWidget {
  final int step;
  final bool loading;
  final VoidCallback? onBack;
  final VoidCallback onNext;

  const _StepActions({
    required this.step,
    required this.loading,
    required this.onBack,
    required this.onNext,
  });

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
          if (onBack != null) ...[
            OutlinedButton(
              onPressed: onBack,
              child: const Text('Quay lại'),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: ElevatedButton(
              onPressed: loading ? null : onNext,
              child: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(step < 2 ? 'Tiếp tục' : 'Đặt hàng'),
            ),
          ),
        ],
      ),
    );
  }
}
