import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../product_list_screen.dart';

class ProductFiltersSheet extends StatefulWidget {
  final ProductListParams current;
  final void Function(ProductListParams) onApply;

  const ProductFiltersSheet(
      {super.key, required this.current, required this.onApply});

  @override
  State<ProductFiltersSheet> createState() =>
      _ProductFiltersSheetState();
}

class _ProductFiltersSheetState
    extends State<ProductFiltersSheet> {
  String? _sort;
  double? _minPrice;
  double? _maxPrice;
  final _minCtrl = TextEditingController();
  final _maxCtrl = TextEditingController();

  static const _sortOptions = [
    ('Mới nhất', 'createdAt:desc'),
    ('Cũ nhất', 'createdAt:asc'),
    ('Tên A-Z', 'name:asc'),
    ('Tên Z-A', 'name:desc'),
    ('Giá thấp nhất', 'price:asc'),
    ('Giá cao nhất', 'price:desc'),
  ];

  @override
  void initState() {
    super.initState();
    _sort = widget.current.sort;
    _minPrice = widget.current.minPrice;
    _maxPrice = widget.current.maxPrice;
    if (_minPrice != null) _minCtrl.text = _minPrice!.toInt().toString();
    if (_maxPrice != null) _maxCtrl.text = _maxPrice!.toInt().toString();
  }

  @override
  void dispose() {
    _minCtrl.dispose();
    _maxCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (_, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Bộ lọc',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w700)),
              TextButton(
                onPressed: () {
                  setState(() {
                    _sort = null;
                    _minPrice = null;
                    _maxPrice = null;
                    _minCtrl.clear();
                    _maxCtrl.clear();
                  });
                },
                child: const Text('Xoá bộ lọc'),
              ),
            ],
          ),
          const Divider(color: AppColors.divider),
          const SizedBox(height: 8),
          const Text('Sắp xếp',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _sortOptions.map((o) {
              final selected = _sort == o.$2;
              return ChoiceChip(
                label: Text(o.$1),
                selected: selected,
                onSelected: (_) =>
                    setState(() => _sort = o.$2),
                selectedColor: AppColors.primarySoft,
                labelStyle: TextStyle(
                  color: selected
                      ? AppColors.primary
                      : AppColors.textSecondary,
                  fontSize: 13,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const Text('Khoảng giá',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _minCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Từ (₫)',
                    hintText: '0',
                  ),
                  onChanged: (v) =>
                      _minPrice = double.tryParse(v),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _maxCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Đến (₫)',
                    hintText: 'Không giới hạn',
                  ),
                  onChanged: (v) =>
                      _maxPrice = double.tryParse(v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => widget.onApply(ProductListParams(
              categorySlug: widget.current.categorySlug,
              brandSlug: widget.current.brandSlug,
              keyword: widget.current.keyword,
              sort: _sort,
              minPrice: _minPrice,
              maxPrice: _maxPrice,
            )),
            child: const Text('Áp dụng'),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
