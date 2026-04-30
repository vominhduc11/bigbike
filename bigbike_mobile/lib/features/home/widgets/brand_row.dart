import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/brand.dart';
import '../../../core/widgets/media_image.dart';
import '../../../core/theme/app_colors.dart';

class BrandRow extends StatelessWidget {
  final List<BrandSummary> brands;
  const BrandRow({super.key, required this.brands});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: brands.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) => GestureDetector(
          onTap: () => context.push('/brands/${brands[i].slug}'),
          child: Container(
            width: 80,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            padding: const EdgeInsets.all(8),
            child: MediaImage(
              src: brands[i].logo,
              fit: BoxFit.contain,
            ),
          ),
        ),
      ),
    );
  }
}
