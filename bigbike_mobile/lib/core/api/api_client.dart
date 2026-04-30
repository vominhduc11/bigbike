import 'dart:io';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';
import '../config/app_config.dart';
import 'api_exception.dart';

class ApiClient {
  late final Dio _dio;
  late final PersistCookieJar _cookieJar;
  bool _initialized = false;

  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  Future<void> init() async {
    if (_initialized) return;
    final dir = await getApplicationDocumentsDirectory();
    _cookieJar = PersistCookieJar(
      storage: FileStorage('${dir.path}/.cookies/'),
    );

    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ));

    _dio.interceptors.add(CookieManager(_cookieJar));
    _dio.interceptors.add(_CsrfInterceptor(_cookieJar));
    _dio.interceptors.add(_ErrorInterceptor());

    _initialized = true;
  }

  Dio get dio => _dio;
  PersistCookieJar get cookieJar => _cookieJar;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParams,
    T Function(dynamic)? fromJson,
  }) async {
    final resp = await _dio.get(path, queryParameters: queryParams);
    if (fromJson != null) return fromJson(resp.data);
    return resp.data as T;
  }

  Future<T> post<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final resp = await _dio.post(path, data: data);
    if (fromJson != null) return fromJson(resp.data);
    return resp.data as T;
  }

  Future<T> patch<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final resp = await _dio.patch(path, data: data);
    if (fromJson != null) return fromJson(resp.data);
    return resp.data as T;
  }

  Future<void> delete(String path, {Map<String, dynamic>? queryParams}) async {
    await _dio.delete(path, queryParameters: queryParams);
  }

  Future<void> clearSession() async {
    await _cookieJar.deleteAll();
  }
}

class _CsrfInterceptor extends Interceptor {
  final PersistCookieJar cookieJar;
  _CsrfInterceptor(this.cookieJar);

  static const _mutateMethods = {'POST', 'PUT', 'PATCH', 'DELETE'};

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (_mutateMethods.contains(options.method.toUpperCase())) {
      try {
        final uri = Uri.parse(options.baseUrl);
        final cookies = await cookieJar.loadForRequest(uri);
        final csrf = cookies.where((c) => c.name == 'bb_csrf').firstOrNull;
        if (csrf != null && csrf.value.isNotEmpty) {
          options.headers['X-CSRF-Token'] = csrf.value;
        }
      } catch (_) {}
    }
    handler.next(options);
  }
}

class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.connectionError) {
      handler.reject(DioException(
        requestOptions: err.requestOptions,
        error: const NetworkException('Không có kết nối mạng'),
        type: err.type,
      ));
      return;
    }

    final response = err.response;
    if (response != null) {
      final data = response.data;
      String message = 'Lỗi không xác định';
      Map<String, dynamic>? errors;

      if (data is Map<String, dynamic>) {
        message = data['message'] as String? ??
            data['error'] as String? ??
            message;
        errors = data['errors'] as Map<String, dynamic>?;
      }

      handler.reject(DioException(
        requestOptions: err.requestOptions,
        error: ApiException(
          statusCode: response.statusCode,
          message: message,
          errors: errors,
        ),
        response: response,
        type: err.type,
      ));
      return;
    }
    handler.next(err);
  }
}

ApiException extractApiException(Object e) {
  if (e is DioException && e.error is ApiException) {
    return e.error as ApiException;
  }
  if (e is DioException && e.error is NetworkException) {
    return ApiException(message: (e.error as NetworkException).message);
  }
  if (e is ApiException) return e;
  return ApiException(message: e.toString());
}
