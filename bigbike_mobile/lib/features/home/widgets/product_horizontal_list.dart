import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/product.dart';
import '../../products/widgets/product_card.dart';

class ProductHorizontalList extends StatelessWidget {
  final List<ProductSummary> products;
  const ProductHorizontalList({super.key, required this.products});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 260,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: products.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) => SizedBox(
          width: 160,
          child: ProductCard(
            product: products[i],
            onTap: () =>
                context.push('/product/${products[i].slug}'),
          ),
        ),
      ),
    );
  }
}
