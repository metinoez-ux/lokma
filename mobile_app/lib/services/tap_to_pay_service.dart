import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import 'package:http/http.dart' as http;

/// LOKMA Stripe Terminal — Tap to Pay on iPhone Service
/// Kurye kapıda ödeme ve restoran masa ödemesi için NFC tabanlı kart okuma.
class TapToPayService {
  static const String _apiBase = 'https://lokma.shop/api';
  static bool _initialized = false;
  static String? _cachedLocationId;

  /// Simülasyon modu: Debug build'de true, Release'de false.
  /// Apple entitlement gelene kadar release'de de true kalabilir.
  static bool get _isSimulated => kDebugMode;

  /// SDK başlat
  static Future<bool> initialize() async {
    if (_initialized) return true;
    if (!Platform.isIOS) {
      debugPrint('⚠️ Tap to Pay sadece iOS destekliyor');
      return false;
    }
    try {
      await Terminal.initTerminal(
        fetchToken: _fetchConnectionToken,
        shouldPrintLogs: kDebugMode,
      );
      _initialized = true;
      debugPrint('✅ Stripe Terminal SDK başlatıldı (simulated: $_isSimulated)');
      return true;
    } catch (e) {
      debugPrint('❌ Stripe Terminal başlatma hatası: $e');
      return false;
    }
  }

  static Future<String> _fetchConnectionToken() async {
    final response = await http.post(
      Uri.parse('$_apiBase/terminal-connection-token'),
      headers: {'Content-Type': 'application/json'},
    ).timeout(const Duration(seconds: 15));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['secret'] as String;
    }
    throw Exception('Connection token error: ${response.statusCode}');
  }

  /// Backend'den işletme için Terminal Location ID al (veya oluştur)
  static Future<String> _getLocationId(String businessId) async {
    // Cache varsa kullan
    if (_cachedLocationId != null) return _cachedLocationId!;

    try {
      final response = await http.post(
        Uri.parse('$_apiBase/get-terminal-location'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'businessId': businessId}),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _cachedLocationId = data['locationId'] as String;
        debugPrint('✅ Terminal location: $_cachedLocationId');
        return _cachedLocationId!;
      }
      throw Exception('Location fetch error: ${response.statusCode}');
    } catch (e) {
      debugPrint('⚠️ Location fetch hatası, fallback kullanılıyor: $e');
      // Simülasyon modunda fallback kabul edilir
      if (_isSimulated) return 'tml_simulated_fallback';
      rethrow;
    }
  }

  /// iPhone NFC reader'a bağlan
  static Future<bool> _connectToiPhoneReader(String locationId) async {
    final terminal = Terminal.instance;
    try {
      final readers = await terminal
          .discoverReaders(
            TapToPayDiscoveryConfiguration(isSimulated: _isSimulated),
          )
          .first;
      if (readers.isEmpty) {
        debugPrint('❌ iPhone NFC reader bulunamadı');
        return false;
      }
      await terminal.connectReader(
        readers.first,
        configuration: TapToPayConnectionConfiguration(
          locationId: locationId,
          autoReconnectOnUnexpectedDisconnect: true,
          merchantDisplayName: 'LOKMA',
          tosAcceptancePermitted: true,
          readerDelegate: _LokmaReaderDelegate(),
        ),
      );
      debugPrint('✅ iPhone NFC reader bağlı (location: $locationId)');
      return true;
    } catch (e) {
      debugPrint('❌ Reader bağlantı hatası: $e');
      return false;
    }
  }

  /// Ana ödeme akışı
  static Future<TapToPayResult> collectPayment({
    required double amount,
    required String businessId,
    required String orderId,
    String? courierId,
    String? description,
    void Function(String status)? onStatusChange,
  }) async {
    if (!_initialized) {
      final ok = await initialize();
      if (!ok) {
        return TapToPayResult(success: false, error: 'Terminal başlatılamadı');
      }
    }

    try {
      // 1. Location ID al
      onStatusChange?.call('Konum alınıyor...');
      final locationId = await _getLocationId(businessId);

      // 2. Reader bağlantısı
      onStatusChange?.call('Bağlanıyor...');
      final connected = await _connectToiPhoneReader(locationId);
      if (!connected) {
        return TapToPayResult(success: false, error: 'NFC reader bağlanamadı');
      }

      // 3. Backend'den terminal payment intent oluştur
      onStatusChange?.call('Ödeme oluşturuluyor...');
      final response = await http.post(
        Uri.parse('$_apiBase/create-terminal-payment-intent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'amount': amount,
          'businessId': businessId,
          'orderId': orderId,
          'courierId': courierId ?? '',
          'description': description ?? 'LOKMA Kapıda Ödeme',
        }),
      ).timeout(const Duration(seconds: 20));

      if (response.statusCode != 200) {
        return TapToPayResult(
          success: false,
          error: 'Ödeme oluşturulamadı: ${response.statusCode}',
        );
      }

      final data = jsonDecode(response.body);
      final clientSecret = data['clientSecret'] as String;
      final paymentIntentId = data['paymentIntentId'] as String;

      final terminal = Terminal.instance;

      // 4. Payment Intent'i al
      onStatusChange?.call('Kartı yaklaştırın...');
      final paymentIntent = await terminal.retrievePaymentIntent(clientSecret);

      // 5. Kart okuma (NFC — CancelableFuture)
      onStatusChange?.call('Kart okunuyor...');
      final collectedIntent = await terminal.collectPaymentMethod(paymentIntent);

      // 6. Ödemeyi onayla (CancelableFuture)
      onStatusChange?.call('Onaylanıyor...');
      await terminal.confirmPaymentIntent(collectedIntent);

      debugPrint('✅ Tap to Pay başarılı: $paymentIntentId');
      return TapToPayResult(success: true, paymentIntentId: paymentIntentId);
    } on TerminalException catch (e) {
      debugPrint('❌ Terminal hatası: ${e.code} — ${e.message}');
      if (e.code == TerminalExceptionCode.canceled) {
        return TapToPayResult(
            success: false, error: 'İptal edildi', wasCancelled: true);
      }
      return TapToPayResult(
          success: false, error: e.message);
    } catch (e) {
      debugPrint('❌ Tap to Pay genel hata: $e');
      return TapToPayResult(success: false, error: e.toString());
    }
  }

  /// Location cache'ini temizle (işletme değiştiğinde)
  static void clearLocationCache() {
    _cachedLocationId = null;
  }

  /// Bağlantıyı kapat
  static Future<void> disconnect() async {
    try {
      await Terminal.instance.disconnectReader();
    } catch (_) {}
  }
}

/// Reader delegate (TapToPay bağlantısı için zorunlu)
class _LokmaReaderDelegate extends TapToPayReaderDelegate {
  @override
  void onAcceptTermsOfService() {
    debugPrint('📋 Stripe ToS kabul edildi');
  }

  @override
  void onStartInstallingUpdate(ReaderSoftwareUpdate update, Future<void> Function() cancelUpdate) {
    debugPrint('🔄 Reader güncelleniyor...');
  }

  @override
  void onReportReaderSoftwareUpdateProgress(double progress) {
    debugPrint('🔄 Güncelleme: ${(progress * 100).toInt()}%');
  }

  @override
  void onFinishInstallingUpdate(ReaderSoftwareUpdate? update, TerminalException? exception) {
    if (exception != null) {
      debugPrint('❌ Güncelleme hatası: ${exception.message}');
    } else {
      debugPrint('✅ Reader güncellendi');
    }
  }

  @override
  void onRequestReaderDisplayMessage(ReaderDisplayMessage message) {
    debugPrint('📱 Reader mesajı: $message');
  }

  @override
  void onRequestReaderInput(List<ReaderInputOption> options) {
    debugPrint('📱 Reader giriş: $options');
  }
}

/// Tap to Pay ödeme sonucu
class TapToPayResult {
  final bool success;
  final String? paymentIntentId;
  final String? error;
  final bool wasCancelled;

  TapToPayResult({
    required this.success,
    this.paymentIntentId,
    this.error,
    this.wasCancelled = false,
  });
}
