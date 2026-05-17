import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
    this.fontSize = 11,
  });

  factory StatusBadge.fromOrderStatus(String status) {
    final (label, color) = switch (status.toUpperCase()) {
      'PENDING'    => ('Chờ xác nhận', AppColors.warning),
      'ON_HOLD'    => ('Tạm giữ', AppColors.warning),
      'PROCESSING' => ('Đang xử lý', AppColors.info),
      'COMPLETED'  => ('Hoàn thành', AppColors.success),
      'CANCELLED'  => ('Đã huỷ', AppColors.textMuted),
      'REFUNDED'   => ('Hoàn tiền', AppColors.info),
      'FAILED'     => ('Thất bại', AppColors.error),
      _ => (status, AppColors.textMuted),
    };
    return StatusBadge(label: label, color: color);
  }

  factory StatusBadge.fromStock(String status) {
    final (label, color) = switch (status.toUpperCase()) {
      'IN_STOCK' => ('Còn hàng', AppColors.success),
      'LOW_STOCK' => ('Sắp hết', AppColors.warning),
      'OUT_OF_STOCK' => ('Hết hàng', AppColors.error),
      'PREORDER' => ('Đặt trước', AppColors.info),
      'CONTACT_FOR_STOCK' => ('Liên hệ', AppColors.textMuted),
      _ => (status, AppColors.textMuted),
    };
    return StatusBadge(label: label, color: color);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
