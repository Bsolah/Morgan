import '../config/app_config.dart';

String normalizeShopInput(String raw) {
  var shop = raw.trim().toLowerCase();
  shop = shop.replaceFirst(RegExp(r'^https?://'), '');
  shop = shop.split('/').first;
  if (shop.isEmpty) return '';
  if (!shop.contains('.')) shop = '$shop.myshopify.com';
  return shop;
}

bool isValidShopDomain(String shop) {
  return RegExp(r'^[a-z0-9][a-z0-9-]*\.myshopify\.com$').hasMatch(shop);
}

String buildShopifyOAuthStartUrl(String shopInput) {
  final shop = normalizeShopInput(shopInput);
  final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
  return '$base/api/v1/auth/shopify/oauth/start?shop=${Uri.encodeComponent(shop)}&platform=mobile';
}

const shopifyOAuthErrorMessages = <String, String>{
  'invalid_state': 'Connection failed — try again.',
  'hmac_mismatch': 'Connection failed — try again.',
  'token_exchange_failed': 'Connection failed — try again.',
  'not_configured': 'Shopify connection is not available right now.',
  'missing_shop_email': 'Could not read a contact email from your Shopify store.',
  'server_error': 'Connection failed — try again.',
  'invalid_shop': 'Enter a valid Shopify store URL (e.g. mystore.myshopify.com).',
};

String shopifyOAuthErrorMessage(String? code) {
  if (code == null || code.isEmpty) return shopifyOAuthErrorMessages['server_error']!;
  return shopifyOAuthErrorMessages[code] ?? shopifyOAuthErrorMessages['server_error']!;
}
