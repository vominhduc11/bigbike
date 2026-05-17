import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/search_result.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/media_image.dart';
import '../../core/utils/formatters.dart';
import '../products/widgets/product_card.dart';

enum _SearchTab { all, products, articles }

class SearchScreen extends StatefulWidget {
  final String query;
  const SearchScreen({super.key, this.query = ''});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final TextEditingController _ctrl;
  SearchResults? _results;
  bool _loading = false;
  _SearchTab _tab = _SearchTab.all;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.query);
    if (widget.query.isNotEmpty) _search(widget.query);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.trim().isEmpty) return;
    setState(() { _loading = true; _results = null; });
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.search,
        queryParams: {'q': q.trim(), 'types': 'product,article'},
      );
      setState(() {
        _results = SearchResults.fromJson(data);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _ctrl,
          autofocus: widget.query.isEmpty,
          onSubmitted: _search,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'Tìm kiếm...',
            hintStyle: const TextStyle(color: AppColors.textMuted),
            border: InputBorder.none,
            filled: false,
            suffixIcon: _ctrl.text.isNotEmpty
                ? IconButton(
                    onPressed: () {
                      _ctrl.clear();
                      setState(() => _results = null);
                    },
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                  )
                : null,
          ),
          textInputAction: TextInputAction.search,
        ),
        actions: [
          TextButton(
            onPressed: () => _search(_ctrl.text),
            child: const Text('Tìm'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _results == null
              ? const _SearchHint()
              : _results!.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.search_off, color: AppColors.textMuted, size: 56),
                          const SizedBox(height: 12),
                          Text('Không tìm thấy kết quả cho "${_results!.query}"',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: AppColors.textMuted)),
                        ],
                      ),
                    )
                  : _SearchResults(results: _results!, tab: _tab, onTabChanged: (t) => setState(() => _tab = t)),
    );
  }
}

class _SearchResults extends StatelessWidget {
  final SearchResults results;
  final _SearchTab tab;
  final void Function(_SearchTab) onTabChanged;

  const _SearchResults({required this.results, required this.tab, required this.onTabChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              _chip('Tất cả', _SearchTab.all, tab, onTabChanged),
              const SizedBox(width: 8),
              _chip('Sản phẩm (${results.products.length})', _SearchTab.products, tab, onTabChanged),
              const SizedBox(width: 8),
              _chip('Tin tức (${results.articles.length})', _SearchTab.articles, tab, onTabChanged),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              if (tab != _SearchTab.articles && results.products.isNotEmpty) ...[
                if (tab == _SearchTab.all)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text('Sản phẩm',
                        style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.58,
                  ),
                  itemCount: results.products.length,
                  itemBuilder: (ctx, i) {
                    final p = results.products[i];
                    return ProductCard(
                        product: p, onTap: () => ctx.push('/product/${p.slug}'));
                  },
                ),
                const SizedBox(height: 16),
              ],
              if (tab != _SearchTab.products && results.articles.isNotEmpty) ...[
                if (tab == _SearchTab.all)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text('Tin tức',
                        style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ...results.articles.map((a) => GestureDetector(
                      onTap: () => context.push('/tin-tuc/${a.slug}'),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: MediaImage(src: a.coverImage, width: 72, height: 56, fit: BoxFit.cover),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(a.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                                  const SizedBox(height: 4),
                                  Text(formatDate(a.publishedAt),
                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    )),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _chip(String label, _SearchTab t, _SearchTab current, void Function(_SearchTab) onChange) {
    final selected = t == current;
    return GestureDetector(
      onTap: () => onChange(t),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.bgSurfaceRaised,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? AppColors.primary : AppColors.borderSubtle),
        ),
        child: Text(label,
            style: TextStyle(
                color: selected ? AppColors.primary : AppColors.textSecondary,
                fontSize: 13,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal)),
      ),
    );
  }
}

class _SearchHint extends StatelessWidget {
  const _SearchHint();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search, color: AppColors.textMuted, size: 56),
          SizedBox(height: 12),
          Text('Nhập từ khoá để tìm kiếm',
              style: TextStyle(color: AppColors.textMuted)),
        ],
      ),
    );
  }
}
