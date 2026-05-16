import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_colors.dart';

/// Email verification screen.
///
/// Two modes, driven by the backend contract
/// (`POST /api/v1/customer/auth/verify-email?token=...`):
///  - With a [token] (e.g. opened from a verification link): the screen
///    auto-submits the token and shows the verify result.
///  - Without a token (the normal post-registration case): the screen tells
///    the customer an email was sent and offers a resend action.
class VerifyEmailScreen extends ConsumerStatefulWidget {
  final String? token;
  const VerifyEmailScreen({super.key, this.token});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

enum _Phase { info, verifying, success, error }

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  late _Phase _phase;
  String _errorMsg = '';
  bool _resending = false;

  @override
  void initState() {
    super.initState();
    final token = widget.token;
    if (token != null && token.isNotEmpty) {
      _phase = _Phase.verifying;
      WidgetsBinding.instance.addPostFrameCallback((_) => _verify(token));
    } else {
      _phase = _Phase.info;
    }
  }

  Future<void> _verify(String token) async {
    try {
      await ApiClient().post(
        ApiEndpoints.verifyEmail,
        queryParams: {'token': token},
      );
      if (!mounted) return;
      setState(() => _phase = _Phase.success);
      // Refresh auth state so the profile reflects the verified status.
      ref.read(authProvider.notifier).refresh();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _errorMsg = extractApiException(e).message;
      });
    }
  }

  Future<void> _resend() async {
    setState(() => _resending = true);
    try {
      await ApiClient().post(ApiEndpoints.resendVerification);
      if (!mounted) return;
      _showSnack(
        'Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư '
        '(kể cả thư mục Spam).',
        AppColors.success,
      );
    } catch (e) {
      if (!mounted) return;
      _showSnack(
        'Không thể gửi lại email: ${extractApiException(e).message}',
        AppColors.error,
      );
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  void _showSnack(String message, Color background) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: background),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAuthenticated =
        ref.watch(authProvider).valueOrNull?.isAuthenticated ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Xác nhận email')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: switch (_phase) {
          _Phase.verifying => _buildVerifying(),
          _Phase.success => _buildSuccess(),
          _Phase.error => _buildError(isAuthenticated),
          _Phase.info => _buildInfo(isAuthenticated),
        },
      ),
    );
  }

  Widget _buildVerifying() {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(height: 64),
        CircularProgressIndicator(color: AppColors.primary),
        SizedBox(height: 24),
        Text(
          'Đang xác thực email...',
          style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600),
        ),
        SizedBox(height: 8),
        Text(
          'Vui lòng đợi trong giây lát.',
          style: TextStyle(color: AppColors.textMuted, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 48),
        const Icon(Icons.check_circle_outline,
            color: AppColors.success, size: 72),
        const SizedBox(height: 24),
        const Text(
          'Email đã được xác thực!',
          textAlign: TextAlign.center,
          style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        const Text(
          'Tài khoản của bạn đã được kích hoạt đầy đủ.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textMuted, fontSize: 14),
        ),
        const SizedBox(height: 32),
        ElevatedButton(
          onPressed: () => context.go('/tai-khoan'),
          style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(52)),
          child: const Text('Vào tài khoản'),
        ),
      ],
    );
  }

  Widget _buildError(bool isAuthenticated) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 48),
        const Icon(Icons.error_outline, color: AppColors.error, size: 72),
        const SizedBox(height: 24),
        const Text(
          'Xác thực không thành công',
          textAlign: TextAlign.center,
          style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          _errorMsg.isEmpty ? 'Đã xảy ra lỗi.' : _errorMsg,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
        ),
        const SizedBox(height: 32),
        if (isAuthenticated)
          ElevatedButton(
            onPressed: _resending ? null : _resend,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(52)),
            child: _resending
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Gửi lại email xác minh'),
          ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.go('/tai-khoan'),
          style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52)),
          child: const Text('Về tài khoản'),
        ),
      ],
    );
  }

  Widget _buildInfo(bool isAuthenticated) {
    final email = ref.watch(authProvider).valueOrNull?.profile?.email;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 32),
        const Icon(Icons.mark_email_unread_outlined,
            color: AppColors.primary, size: 64),
        const SizedBox(height: 24),
        const Text(
          'Xác nhận email của bạn',
          textAlign: TextAlign.center,
          style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          email != null && email.isNotEmpty
              ? 'Chúng tôi đã gửi email xác minh tới $email. '
                  'Vui lòng mở liên kết trong email để kích hoạt tài khoản.'
              : 'Chúng tôi đã gửi email xác minh tới hộp thư của bạn. '
                  'Vui lòng mở liên kết trong email để kích hoạt tài khoản.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
        ),
        const SizedBox(height: 32),
        if (isAuthenticated)
          ElevatedButton(
            onPressed: _resending ? null : _resend,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(52)),
            child: _resending
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Gửi lại email xác minh'),
          )
        else
          const Text(
            'Đăng nhập để gửi lại email xác minh.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.go(isAuthenticated ? '/tai-khoan' : '/'),
          style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52)),
          child: Text(isAuthenticated ? 'Để sau' : 'Về trang chủ'),
        ),
      ],
    );
  }
}
