class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final Map<String, dynamic>? errors;
  final List<Map<String, dynamic>>? details;

  const ApiException({
    this.statusCode,
    required this.message,
    this.errors,
    this.details,
  });

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isValidation => statusCode == 422 || statusCode == 400;
  bool get isServer => (statusCode ?? 0) >= 500;
  String get displayMessage {
    final firstMessage = details
        ?.map((detail) => detail['message'])
        .whereType<String>()
        .firstOrNull;
    if (firstMessage != null && firstMessage.trim().isNotEmpty) {
      return firstMessage.trim();
    }
    return message;
  }

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class NetworkException implements Exception {
  final String message;
  const NetworkException(this.message);

  @override
  String toString() => 'NetworkException: $message';
}
