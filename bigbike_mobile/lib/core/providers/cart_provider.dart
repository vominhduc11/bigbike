import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../models/cart.dart';

class CartNotifier extends AsyncNotifier<Cart> {
  @override
  Future<Cart> build() => _fetch();

  Future<Cart> _fetch() async {
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(ApiEndpoints.cart);
      return Cart.fromJson(data);
    } catch (_) {
      return Cart.empty();
    }
  }

  Future<void> refresh() async {
    state = AsyncValue.data(await _fetch());
  }

  Future<void> addItem(String productId, int quantity, {String? variantId}) async {
    try {
      final data = await ApiClient().post<Map<String, dynamic>>(
        ApiEndpoints.cartItems,
        data: {
          'productId': productId,
          'quantity': quantity,
          'variantId': ?variantId,
        },
      );
      state = AsyncValue.data(Cart.fromJson(data));
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> updateItem(String itemId, int quantity) async {
    try {
      final data = await ApiClient().patch<Map<String, dynamic>>(
        ApiEndpoints.cartItem(itemId),
        data: {'quantity': quantity},
      );
      state = AsyncValue.data(Cart.fromJson(data));
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> removeItem(String itemId) async {
    try {
      await ApiClient().delete(ApiEndpoints.cartItem(itemId));
      await refresh();
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> clear() async {
    try {
      await ApiClient().delete(ApiEndpoints.cartClear);
      state = AsyncValue.data(Cart.empty());
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> applyCoupon(String code) async {
    try {
      final data = await ApiClient().post<Map<String, dynamic>>(
        ApiEndpoints.cartCoupons,
        data: {'code': code},
      );
      state = AsyncValue.data(Cart.fromJson(data));
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }

  Future<void> removeCoupon(String code) async {
    try {
      await ApiClient().delete(ApiEndpoints.cartCoupon(code));
      await refresh();
    } catch (e, st) {
      state = AsyncValue.error(extractApiException(e), st);
      rethrow;
    }
  }
}

final cartProvider =
    AsyncNotifierProvider<CartNotifier, Cart>(CartNotifier.new);

final cartCountProvider = Provider<int>((ref) {
  return ref.watch(cartProvider).valueOrNull?.itemCount ?? 0;
});
