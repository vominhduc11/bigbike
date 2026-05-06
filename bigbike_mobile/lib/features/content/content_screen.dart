import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/page_content.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/error_view.dart';

class ContentScreen extends StatefulWidget {
  final String slug;
  const ContentScreen({super.key, required this.slug});

  @override
  State<ContentScreen> createState() => _ContentScreenState();
}

class _ContentScreenState extends State<ContentScreen> {
  PageContent? _page;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await ApiClient()
          .get<Map<String, dynamic>>(ApiEndpoints.page(widget.slug));
      final data = raw['data'] as Map<String, dynamic>? ?? raw;
      setState(() {
        _page = PageContent.fromJson(data);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _page?.title ?? widget.slug.replaceAll('-', ' '),
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(
                  message: 'Không tìm thấy trang này',
                  onRetry: _load,
                )
              : _page == null
                  ? const EmptyState(message: 'Trang không tồn tại')
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_page!.updatedAt != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                'Cập nhật: ${formatDate(_page!.updatedAt)}',
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          HtmlWidget(
                            _page!.body ?? '',
                            textStyle: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 15,
                              height: 1.7,
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }
}
