class Validators {
  static String? required(String? v, [String? label]) {
    if (v == null || v.trim().isEmpty) {
      return '${label ?? 'Trường này'} không được để trống';
    }
    return null;
  }

  static String? email(String? v) {
    if (v == null || v.trim().isEmpty) return 'Email không được để trống';
    final re = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!re.hasMatch(v.trim())) return 'Email không hợp lệ';
    return null;
  }

  static String? phone(String? v) {
    if (v == null || v.trim().isEmpty) return 'Số điện thoại không được để trống';
    final re = RegExp(r'^(0[3-9]\d{8}|84[3-9]\d{8}|\+84[3-9]\d{8})$');
    if (!re.hasMatch(v.trim().replaceAll(' ', ''))) {
      return 'Số điện thoại không hợp lệ';
    }
    return null;
  }

  static String? minLength(String? v, int min, [String? label]) {
    if (v == null || v.length < min) {
      return '${label ?? 'Trường này'} cần ít nhất $min ký tự';
    }
    return null;
  }

  static String? password(String? v) {
    if (v == null || v.isEmpty) return 'Mật khẩu không được để trống';
    if (v.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự';
    return null;
  }

  static String? confirmPassword(String? v, String? password) {
    if (v == null || v.isEmpty) return 'Vui lòng xác nhận mật khẩu';
    if (v != password) return 'Mật khẩu không khớp';
    return null;
  }

  static String? loginId(String? v) {
    if (v == null || v.trim().isEmpty) {
      return 'Email hoặc số điện thoại không được để trống';
    }
    return null;
  }
}
