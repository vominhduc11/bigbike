/// Result of the public warranty lookup endpoint
/// `GET /api/v1/warranties/lookup?serial={serialNumber}`.
///
/// The endpoint wraps the payload in an `ApiDataResponse` envelope, so this
/// model is parsed from the inner `data` map — not the raw response body.
class WarrantyLookupResult {
  final String serialNumber;
  final String productName;
  final String startDate;
  final String endDate;
  final String status;
  final int daysLeft;

  const WarrantyLookupResult({
    required this.serialNumber,
    required this.productName,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.daysLeft,
  });

  factory WarrantyLookupResult.fromJson(Map<String, dynamic> j) =>
      WarrantyLookupResult(
        serialNumber: j['serialNumber'] as String? ?? '',
        productName: j['productName'] as String? ?? '',
        startDate: j['startDate'] as String? ?? '',
        endDate: j['endDate'] as String? ?? '',
        status: j['status'] as String? ?? '',
        daysLeft: (j['daysLeft'] as num?)?.toInt() ?? 0,
      );
}
