import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../models/customer.dart';

sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAnonymous extends AuthState {
  const AuthAnonymous();
}

class AuthAuthenticated extends AuthState {
  final CustomerProfile profile;
  const AuthAuthenticated(this.profile);
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    return _fetchMe();
  }

  Future<AuthState> _fetchMe() async {
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.me,
      );
      return AuthAuthenticated(CustomerProfile.fromJson(data));
    } catch (_) {
      return const AuthAnonymous();
    }
  }

  Future<void> login(String loginId, String password) async {
    state = const AsyncValue.loading();
    try {
      await ApiClient().post(ApiEndpoints.login, data: {
        'login': loginId,
        'password': password,
      });
      final next = await _fetchMe();
      state = AsyncValue.data(next);
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    String? lastName,
  }) async {
    state = const AsyncValue.loading();
    try {
      await ApiClient().post(ApiEndpoints.register, data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
      });
      final next = await _fetchMe();
      state = AsyncValue.data(next);
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await ApiClient().post(ApiEndpoints.logout);
    } catch (_) {}
    await ApiClient().clearSession();
    state = const AsyncValue.data(AuthAnonymous());
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    try {
      final updated = await ApiClient().patch<Map<String, dynamic>>(
        ApiEndpoints.me,
        data: data,
      );
      state = AsyncValue.data(AuthAuthenticated(
        CustomerProfile.fromJson(updated),
      ));
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> refresh() async {
    final next = await _fetchMe();
    state = AsyncValue.data(next);
  }
}

final authProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

extension AuthStateX on AuthState {
  bool get isAuthenticated => this is AuthAuthenticated;
  bool get isAnonymous => this is AuthAnonymous;
  bool get isLoading => this is AuthLoading;
  CustomerProfile? get profile =>
      this is AuthAuthenticated ? (this as AuthAuthenticated).profile : null;
}
