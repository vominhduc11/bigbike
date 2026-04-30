import 'package:flutter/material.dart';
import '../models/common.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';

class PriceText extends StatelessWidget {
  final ProductPrice price;
  final double fontSize;
  final bool compact;

  const PriceText({
    super.key,
    required this.price,
    this.fontSize = 16,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final display = price.displayPrice;
    final hasDiscount = price.hasDiscount;

    if (compact) {
      return Text(
        formatVnd(display),
        style: TextStyle(
          color: hasDiscount ? AppColors.primary : AppColors.textPrimary,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          formatVnd(display),
          style: TextStyle(
            color: hasDiscount ? AppColors.primary : AppColors.textPrimary,
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (hasDiscount) ...[
          const SizedBox(width: 6),
          Text(
            formatVnd(price.retailPrice),
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: fontSize * 0.8,
              decoration: TextDecoration.lineThrough,
              decorationColor: AppColors.textMuted,
            ),
          ),
        ],
      ],
    );
  }
}
