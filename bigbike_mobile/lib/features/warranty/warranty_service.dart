import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exception.dart';
import '../../core/models/warranty.dart';

/// Talks to the public warranty lookup endpoint. No auth required — mirrors
/// the web `/bao-hanh` page.
class WarrantyService {
  /// Looks up warranty info for [serialNumber].
  ///
  /// The serial is trimmed client-side; the backend normalizes case, so no
  /// uppercase conversion is needed here. Throws [ApiException] on any failure
  /// (empty input, 404 not found, network/server error) — never returns null.
  Future<WarrantyLookupResult> lookupWarranty(String serialNumber) async {
    final serial = serialNumber.trim();
    if (serial.isEmpty) {
      throw const ApiException(message: 'Vui lòng nhập số serial.');
    }
    try {
      final body = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.warrantyLookup,
        queryParams: {'serial': serial},
      );
      // Public endpoint wraps the payload in an ApiDataResponse envelope.
      final data = body['data'];
      if (data is! Map<String, dynamic>) {
        throw const ApiException(
            message: 'Phản hồi không hợp lệ từ máy chủ.');
      }
      return WarrantyLookupResult.fromJson(data);
    } catch (e) {
      throw extractApiException(e);
    }
  }
}
