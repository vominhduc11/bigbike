import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../features/shell/app_shell.dart';
import '../../features/home/home_screen.dart';
import '../../features/products/product_list_screen.dart';
import '../../features/products/product_detail_screen.dart';
import '../../features/categories/category_list_screen.dart';
import '../../features/categories/category_detail_screen.dart';
import '../../features/brands/brand_list_screen.dart';
import '../../features/brands/brand_detail_screen.dart';
import '../../features/cart/cart_screen.dart';
import '../../features/checkout/checkout_screen.dart';
import '../../features/checkout/order_confirmation_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/register_screen.dart';
import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/verify_email_screen.dart';
import '../../features/account/account_screen.dart';
import '../../features/account/edit_profile_screen.dart';
import '../../features/account/addresses_screen.dart';
import '../../features/account/orders_screen.dart';
import '../../features/account/order_detail_screen.dart';
import '../../features/account/returns_screen.dart';
import '../../features/account/wishlist_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/articles/article_list_screen.dart';
import '../../features/articles/article_detail_screen.dart';
import '../../features/contact/contact_screen.dart';
import '../../features/content/content_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isAuthenticated =
          authState.valueOrNull?.isAuthenticated ?? false;
      final isAuthRoute = state.matchedLocation.startsWith('/dang-nhap') ||
          state.matchedLocation.startsWith('/dang-ky') ||
          state.matchedLocation.startsWith('/quen-mat-khau');
      final isAccountRoute =
          state.matchedLocation.startsWith('/tai-khoan') ||
          state.matchedLocation.startsWith('/thanh-toan');

      if (isAccountRoute && !isAuthenticated) {
        return '/dang-nhap?redirect=${Uri.encodeComponent(state.uri.toString())}';
      }
      return null;
    },
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          // 0: Home
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/',
              builder: (c, s) => const HomeScreen(),
            ),
          ]),
          // 1: Products
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/san-pham',
              builder: (c, s) => ProductListScreen(
                categorySlug: s.uri.queryParameters['category'],
                brandSlug: s.uri.queryParameters['brand'],
                keyword: s.uri.queryParameters['q'],
              ),
            ),
          ]),
          // 2: Cart
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/gio-hang',
              builder: (c, s) => const CartScreen(),
            ),
          ]),
          // 3: Account
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/tai-khoan',
              builder: (c, s) => const AccountScreen(),
            ),
          ]),
        ],
      ),

      // Product detail
      GoRoute(
        path: '/product/:slug',
        builder: (c, s) => ProductDetailScreen(slug: s.pathParameters['slug']!),
      ),

      // Categories
      GoRoute(
        path: '/danh-muc-san-pham',
        builder: (c, s) => const CategoryListScreen(),
      ),
      GoRoute(
        path: '/danh-muc-san-pham/:slug',
        builder: (c, s) =>
            CategoryDetailScreen(slug: s.pathParameters['slug']!),
      ),

      // Brands
      GoRoute(
        path: '/brands',
        builder: (c, s) => const BrandListScreen(),
      ),
      GoRoute(
        path: '/brands/:slug',
        builder: (c, s) => BrandDetailScreen(slug: s.pathParameters['slug']!),
      ),

      // Search
      GoRoute(
        path: '/tim-kiem',
        builder: (c, s) =>
            SearchScreen(query: s.uri.queryParameters['q'] ?? ''),
      ),

      // Articles
      GoRoute(
        path: '/tin-tuc',
        builder: (c, s) => const ArticleListScreen(),
      ),
      GoRoute(
        path: '/tin-tuc/:slug',
        builder: (c, s) =>
            ArticleDetailScreen(slug: s.pathParameters['slug']!),
      ),

      // Checkout
      GoRoute(
        path: '/thanh-toan',
        builder: (c, s) => const CheckoutScreen(),
      ),
      GoRoute(
        path: '/don-hang/xac-nhan',
        builder: (c, s) => OrderConfirmationScreen(
          orderNumber: s.uri.queryParameters['orderNumber'] ?? '',
          orderKey: s.uri.queryParameters['orderKey'] ?? '',
        ),
      ),

      // Auth
      GoRoute(
        path: '/dang-nhap',
        builder: (c, s) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dang-ky',
        builder: (c, s) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/quen-mat-khau',
        builder: (c, s) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/xac-nhan-email',
        builder: (c, s) =>
            VerifyEmailScreen(token: s.uri.queryParameters['token']),
      ),

      // Account sub-routes
      GoRoute(
        path: '/tai-khoan/edit-account',
        builder: (c, s) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/tai-khoan/dia-chi',
        builder: (c, s) => const AddressesScreen(),
      ),
      GoRoute(
        path: '/tai-khoan/don-hang',
        builder: (c, s) => const OrdersScreen(),
      ),
      GoRoute(
        path: '/tai-khoan/don-hang/:id',
        builder: (c, s) =>
            OrderDetailScreen(orderId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/tai-khoan/doi-tra',
        builder: (c, s) => const ReturnsScreen(),
      ),
      GoRoute(
        path: '/tai-khoan/yeu-thich',
        builder: (c, s) => const WishlistScreen(),
      ),

      // Contact
      GoRoute(
        path: '/lien-he',
        builder: (c, s) => const ContactScreen(),
      ),

      // Policy and guide pages (must be declared before the catch-all)
      GoRoute(
        path: '/chinh-sach/:slug',
        builder: (c, s) => ContentScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/huong-dan/:slug',
        builder: (c, s) => ContentScreen(slug: s.pathParameters['slug']!),
      ),

      // CMS pages (catch-all)
      GoRoute(
        path: '/:slug',
        builder: (c, s) => ContentScreen(slug: s.pathParameters['slug']!),
      ),
    ],
  );
});
