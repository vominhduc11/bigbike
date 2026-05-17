import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// [Storage] implementation for [PersistCookieJar] that keeps cookie data in
/// the platform secure store (iOS Keychain / Android Keystore-backed storage)
/// instead of a plaintext file under the app documents directory.
///
/// The session cookie (`bb_session`) is an authentication credential — storing
/// it in cleartext on disk exposes it to device-backup extraction and rooted
/// devices. This adapter routes all cookie reads/writes through
/// [FlutterSecureStorage].
///
/// Note: switching storage backends drops any cookies persisted by the old
/// file storage, so users will need to sign in again once after the update.
class SecureCookieStorage implements Storage {
  SecureCookieStorage({String namespace = 'bb_cookies'})
      : _prefix = '$namespace:';

  final String _prefix;

  static const FlutterSecureStorage _secure = FlutterSecureStorage();

  String _key(String key) => '$_prefix$key';

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {
    // No initialization needed — the secure store is created lazily.
  }

  @override
  Future<String?> read(String key) => _secure.read(key: _key(key));

  @override
  Future<void> write(String key, String value) =>
      _secure.write(key: _key(key), value: value);

  @override
  Future<void> delete(String key) => _secure.delete(key: _key(key));

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final key in keys) {
      await _secure.delete(key: _key(key));
    }
  }
}
