import 'package:flutter/material.dart';
import '../products/product_list_screen.dart';

class BrandDetailScreen extends StatelessWidget {
  final String slug;
  const BrandDetailScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context) {
    return ProductListScreen(brandSlug: slug, key: ValueKey(slug));
  }
}
