class ApiEndpoints {
  // Products
  static const String products = '/api/v1/products';
  static String product(String slug) => '/api/v1/products/$slug';
  static String productSnapshot(String id) => '/api/v1/products/$id/snapshot';
  static String productReviews(String id) => '/api/v1/products/$id/reviews';

  // Categories
  static const String categories = '/api/v1/categories';
  static String category(String slug) => '/api/v1/categories/$slug';

  // Brands
  static const String brands = '/api/v1/brands';
  static String brand(String slug) => '/api/v1/brands/$slug';

  // Articles
  static const String articles = '/api/v1/articles';
  static String article(String slug) => '/api/v1/articles/$slug';

  // Pages & Menus
  static String page(String slug) => '/api/v1/pages/$slug';
  static String menu(String location) => '/api/v1/menus/$location';
  static const String publicSettings = '/api/v1/settings/public';
  static const String sliders = '/api/v1/sliders';
  // CMS-004: home videos endpoint — UI integration pending (widget not yet implemented).
  static const String homeVideos = '/api/v1/home-videos';

  // Search
  static const String search = '/api/v1/search';
  static const String searchSuggest = '/api/v1/search-suggest';

  // Cart
  static const String cart = '/api/v1/cart';
  static const String cartItems = '/api/v1/cart/items';
  static String cartItem(String itemId) => '/api/v1/cart/items/$itemId';
  static const String cartClear = '/api/v1/cart/clear';
  static const String cartCoupons = '/api/v1/cart/coupons';
  static String cartCoupon(String code) => '/api/v1/cart/coupons/$code';

  // Checkout
  static const String checkout = '/api/v1/checkout';
  static const String checkoutOptions = '/api/v1/checkout/options';
  static const String quickBuy = '/api/v1/orders/quick-buy';
  static const String orderLookup = '/api/v1/orders/lookup';

  // Auth
  static const String login = '/api/v1/customer/auth/login';
  static const String register = '/api/v1/customer/auth/register';
  static const String logout = '/api/v1/customer/auth/logout';
  static const String forgotPassword = '/api/v1/customer/auth/password/forgot';
  static const String resetPassword = '/api/v1/customer/auth/password/reset';
  static const String verifyEmail = '/api/v1/customer/auth/verify-email';
  static const String resendVerification =
      '/api/v1/customer/auth/resend-verification';

  // Customer
  static const String me = '/api/v1/customer/me';
  static const String addresses = '/api/v1/customer/addresses';
  static String address(String id) => '/api/v1/customer/addresses/$id';
  static const String myOrders = '/api/v1/customer/orders';
  static String myOrder(String id) => '/api/v1/customer/orders/$id';
  static const String myReturns = '/api/v1/customer/orders/returns';
  static String myReturn(String returnId) =>
      '/api/v1/customer/orders/returns/$returnId';
  static String createReturn(String orderId) =>
      '/api/v1/customer/orders/$orderId/returns';

  // Contact
  static const String contact = '/api/v1/contact';

  // VN Address data
  static const String provinces = '/api/v1/address/provinces';
  static String districts(String provinceCode) =>
      '/api/v1/address/provinces/$provinceCode/districts';
  static String wards(String districtCode) =>
      '/api/v1/address/districts/$districtCode/wards';
}
