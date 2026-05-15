import 'package:intl/intl.dart';

final _vndFormatter = NumberFormat.currency(
  locale: 'vi_VN',
  symbol: '₫',
  decimalDigits: 0,
);

final _dateFormatter = DateFormat('dd/MM/yyyy');
final _dateTimeFormatter = DateFormat('HH:mm dd/MM/yyyy');

String formatVnd(double amount) => _vndFormatter.format(amount);

String formatDate(String? isoDate) {
  if (isoDate == null) return '';
  try {
    final dt = DateTime.parse(isoDate).toLocal();
    return _dateFormatter.format(dt);
  } catch (_) {
    return isoDate;
  }
}

String formatDateTime(String? isoDate) {
  if (isoDate == null) return '';
  try {
    final dt = DateTime.parse(isoDate).toLocal();
    return _dateTimeFormatter.format(dt);
  } catch (_) {
    return isoDate;
  }
}

String orderStatusLabel(String status) => switch (status.toUpperCase()) {
      'PENDING' => 'Chờ xác nhận',
      'CONFIRMED' => 'Đã xác nhận',
      'PROCESSING' => 'Đang xử lý',
      'SHIPPED' => 'Đang giao',
      'DELIVERED' => 'Đã giao',
      'COMPLETED' => 'Hoàn thành',
      'CANCELLED' => 'Đã huỷ',
      'REFUNDED' => 'Đã hoàn tiền',
      _ => status,
    };

String paymentStatusLabel(String status) => switch (status.toUpperCase()) {
      'UNPAID' => 'Chưa thanh toán',
      'PAID' => 'Đã thanh toán',
      'REFUNDED' => 'Đã hoàn tiền',
      'CANCELLED' => 'Đã huỷ',
      _ => status,
    };
