class CustomerProfile {
  final String id;
  final String? email;
  final String? phone;
  final String? displayName;
  final String status;
  final String? gender;
  final String? dob;

  const CustomerProfile({
    required this.id,
    this.email,
    this.phone,
    this.displayName,
    required this.status,
    this.gender,
    this.dob,
  });

  String get nameOrEmail =>
      displayName?.isNotEmpty == true
          ? displayName!
          : email ?? phone ?? 'Khách hàng';

  factory CustomerProfile.fromJson(Map<String, dynamic> j) => CustomerProfile(
        id: j['id'].toString(),
        email: j['email'] as String?,
        phone: j['phone'] as String?,
        displayName: j['displayName'] as String?,
        status: j['status'] as String? ?? 'active',
        gender: j['gender'] as String?,
        dob: j['dob'] as String?,
      );
}

class CustomerAddress {
  final String id;
  final String type;
  final String fullName;
  final String phone;
  final String? country;
  final String province;
  final String district;
  final String ward;
  final String addressLine1;
  final String? addressLine2;
  final bool isDefault;

  const CustomerAddress({
    required this.id,
    required this.type,
    required this.fullName,
    required this.phone,
    this.country,
    required this.province,
    required this.district,
    required this.ward,
    required this.addressLine1,
    this.addressLine2,
    required this.isDefault,
  });

  String get fullAddress {
    final parts = [addressLine1, ward, district, province]
        .where((s) => s.isNotEmpty)
        .toList();
    return parts.join(', ');
  }

  factory CustomerAddress.fromJson(Map<String, dynamic> j) => CustomerAddress(
        id: j['id'].toString(),
        type: j['type'] as String? ?? 'shipping',
        fullName: j['fullName'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
        country: j['country'] as String?,
        province: j['province'] as String? ?? '',
        district: j['district'] as String? ?? '',
        ward: j['ward'] as String? ?? '',
        addressLine1: j['addressLine1'] as String? ?? '',
        addressLine2: j['addressLine2'] as String?,
        isDefault: j['isDefault'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'fullName': fullName,
        'phone': phone,
        if (country != null) 'country': country,
        'province': province,
        'district': district,
        'ward': ward,
        'addressLine1': addressLine1,
        if (addressLine2 != null) 'addressLine2': addressLine2,
        'isDefault': isDefault,
      };
}
