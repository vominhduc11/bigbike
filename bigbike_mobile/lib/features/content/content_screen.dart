import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';

class ContentScreen extends StatefulWidget {
  final String slug;
  const ContentScreen({super.key, required this.slug});

  @override
  State<ContentScreen> createState() => _ContentScreenState();
}

class _ContentScreenState extends State<ContentScreen> {
  Map<String, dynamic>? _page;
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
      setState(() { _page = raw['data'] as Map<String, dynamic>? ?? raw; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _page?['title'] as String? ?? widget.slug.replaceAll('-', ' '),
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
                      child: HtmlWidget(
                        _page!['body'] as String? ?? '',
                        textStyle: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.7,
                        ),
                      ),
                    ),
    );
  }
}
