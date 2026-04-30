class SiteSettings {
  final String? storeName;
  final String? hotline;
  final String? email;
  final String? address;
  final String? zaloUrl;
  final String? facebookUrl;
  final String? youtubeUrl;
  final String? tiktokUrl;
  final String? instagramUrl;
  final String? aboutText;
  final String? promoText;
  final String? bctUrl;
  final String? logoUrl;

  const SiteSettings({
    this.storeName,
    this.hotline,
    this.email,
    this.address,
    this.zaloUrl,
    this.facebookUrl,
    this.youtubeUrl,
    this.tiktokUrl,
    this.instagramUrl,
    this.aboutText,
    this.promoText,
    this.bctUrl,
    this.logoUrl,
  });

  factory SiteSettings.fromJson(Map<String, dynamic> j) {
    Map<String, String> flat = {};
    if (j['settings'] is List) {
      for (final item in j['settings'] as List) {
        if (item is Map<String, dynamic>) {
          final key = item['key'] as String?;
          final value = item['value'] as String?;
          if (key != null && value != null) flat[key] = value;
        }
      }
    } else if (j is Map<String, dynamic>) {
      j.forEach((k, v) { if (v is String) flat[k] = v; });
    }
    return SiteSettings(
      storeName: flat['store_name'] ?? flat['storeName'],
      hotline: flat['hotline'] ?? flat['phone'],
      email: flat['contact_email'] ?? flat['email'],
      address: flat['address'],
      zaloUrl: flat['zalo_url'] ?? flat['zaloUrl'],
      facebookUrl: flat['facebook_url'] ?? flat['facebookUrl'],
      youtubeUrl: flat['youtube_url'] ?? flat['youtubeUrl'],
      tiktokUrl: flat['tiktok_url'] ?? flat['tiktokUrl'],
      instagramUrl: flat['instagram_url'] ?? flat['instagramUrl'],
      aboutText: flat['about_text'] ?? flat['aboutText'],
      promoText: flat['promo_text'] ?? flat['promoText'],
      bctUrl: flat['bct_url'] ?? flat['bctUrl'],
      logoUrl: flat['logo_url'] ?? flat['logoUrl'],
    );
  }
}
