import 'package:flutter/material.dart';
import '../../../core/models/product.dart';
import '../../../core/widgets/media_image.dart';
import '../../../core/widgets/price_text.dart';
import '../../../core/widgets/rating_stars.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/theme/app_colors.dart';

class ProductCard extends StatelessWidget {
  final ProductSummary product;
  final VoidCallback? onTap;

  const ProductCard({super.key, required this.product, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(10)),
              child: Stack(
                children: [
                  MediaImage(
                    src: product.image,
                    width: double.infinity,
                    height: 170,
                    fit: BoxFit.cover,
                  ),
                  if (product.price.hasDiscount)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '-${_discountPct(product.price.retailPrice, product.price.displayPrice)}%',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  PriceText(price: product.price, fontSize: 14),
                  if (product.rating != null && product.rating! > 0) ...[
                    const SizedBox(height: 4),
                    RatingStars(
                      rating: product.rating!,
                      size: 12,
                      reviewCount: product.reviewCount,
                    ),
                  ],
                  const SizedBox(height: 4),
                  StatusBadge.fromStock(
                      product.stockState.name.toUpperCase()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  int _discountPct(double original, double sale) {
    if (original <= 0) return 0;
    return (((original - sale) / original) * 100).round();
  }
}
