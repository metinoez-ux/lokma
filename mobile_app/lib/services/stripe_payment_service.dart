import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;
import 'package:lokma_app/config/app_secrets.dart';

/// Stripe Payment Service for LOKMA
/// Handles payment sheet initialization and processing
class StripePaymentService {
  static bool _isInitialized = false;
  
  /// Initialize Stripe SDK - call once at app startup
  static Future<void> initialize() async {
    // Skip initialization if key is placeholder
    if (AppSecrets.stripePublishableKey.isEmpty || 
        AppSecrets.stripePublishableKey.contains('BURAYA') ||
        !AppSecrets.stripePublishableKey.startsWith('pk_')) {
      debugPrint('⚠️ Stripe SDK not initialized - invalid publishable key');
      return;
    }
    
    try {
      Stripe.publishableKey = AppSecrets.stripePublishableKey;
      await Stripe.instance.applySettings();
      _isInitialized = true;
      debugPrint('✅ Stripe SDK initialized');
    } catch (e) {
      debugPrint('❌ Stripe SDK initialization failed: $e');
    }
  }
  
  /// Check if Stripe is ready to use
  static bool get isReady => _isInitialized;
  
  static const String _apiBaseUrl = 'https://lokma.shop/api';

  /// Create a payment and show payment sheet
  /// Returns PaymentResult with fee breakdown for order records
  static Future<PaymentResult> processPayment({
    required double amount,
    required String businessId,
    required String orderId,
    String? customerEmail,
  }) async {
    // Check if Stripe is ready
    if (!isReady) {
      debugPrint('⚠️ Stripe not initialized - card payments unavailable');
      return PaymentResult(
        success: false,
        error: 'Kart ödemesi şu an kullanılamıyor',
      );
    }
    
    try {
      debugPrint('💳 Creating payment intent for €$amount...');
      
      // 1. Create Payment Intent on backend
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/create-payment-intent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'amount': amount,
          'businessId': businessId,
          'orderId': orderId,
          'customerEmail': customerEmail,
        }),
      );

      if (response.statusCode != 200) {
        debugPrint('❌ Payment intent creation failed: ${response.body}');
        return PaymentResult(
          success: false,
          error: 'Ödeme oluşturulamadı: ${response.statusCode}',
        );
      }

      final data = jsonDecode(response.body);
      final clientSecret = data['clientSecret'];
      
      if (clientSecret == null) {
        return PaymentResult(
          success: false,
          error: 'Geçersiz sunucu yanıtı',
        );
      }

      debugPrint('✅ Payment intent created: ${data['paymentIntentId']}');
      
      // Extract fee breakdown from response
      FeeBreakdown? feeBreakdown;
      if (data['feeBreakdown'] != null) {
        final fb = data['feeBreakdown'];
        feeBreakdown = FeeBreakdown(
          customerPaid: (fb['customerPaid'] as num).toDouble(),
          stripeFee: (fb['stripeFee'] as num).toDouble(),
          commissionGross: (fb['commissionGross'] as num).toDouble(),
          commissionNet: (fb['commissionNet'] as num).toDouble(),
          commissionVat: (fb['commissionVat'] as num).toDouble(),
          merchantTransfer: (fb['merchantTransfer'] as num).toDouble(),
          platformNetRevenue: (fb['platformNetRevenue'] as num).toDouble(),
          commissionRate: (fb['commissionRate'] as num).toDouble(),
          vatRate: (fb['vatRate'] as num).toDouble(),
        );
        debugPrint('📊 Fee breakdown: Stripe €${feeBreakdown.stripeFee.toStringAsFixed(2)}, Commission €${feeBreakdown.commissionGross.toStringAsFixed(2)}, Merchant €${feeBreakdown.merchantTransfer.toStringAsFixed(2)}');
      }

      // 2. Initialize Payment Sheet
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'LOKMA',
          style: ThemeMode.dark,
          appearance: const PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: Color(0xFFFB335B),
              background: Color(0xFF1E1E1E),
              componentBackground: Color(0xFF2C2C2C),
              componentText: Colors.white,
              primaryText: Colors.white,
              secondaryText: Colors.grey,
            ),
            shapes: PaymentSheetShape(
              borderRadius: 16,
              borderWidth: 1,
            ),
          ),
          billingDetails: BillingDetails(
            email: customerEmail,
          ),
        ),
      );

      debugPrint('✅ Payment sheet initialized');

      // 3. Present Payment Sheet
      await Stripe.instance.presentPaymentSheet();
      
      debugPrint('✅ Payment completed successfully!');
      
      return PaymentResult(
        success: true,
        paymentIntentId: data['paymentIntentId'],
        feeBreakdown: feeBreakdown,
      );

    } on StripeException catch (e) {
      debugPrint('❌ Stripe error: ${e.error.localizedMessage}');
      
      if (e.error.code == FailureCode.Canceled) {
        return PaymentResult(
          success: false,
          error: 'Ödeme iptal edildi',
          wasCancelled: true,
        );
      }
      
      return PaymentResult(
        success: false,
        error: e.error.localizedMessage ?? 'Ödeme hatası',
      );
    } catch (e) {
      debugPrint('❌ Payment error: $e');
      return PaymentResult(
        success: false,
        error: 'Beklenmeyen hata: $e',
      );
    }
  }
}

/// Complete fee breakdown for German tax compliance
class FeeBreakdown {
  final double customerPaid;       // What customer paid
  final double stripeFee;          // Stripe processing fee
  final double commissionGross;    // Platform commission (brutto)
  final double commissionNet;      // Commission after VAT
  final double commissionVat;      // VAT portion of commission
  final double merchantTransfer;   // Amount transferred to merchant
  final double platformNetRevenue; // Platform revenue after Stripe fee
  final double commissionRate;     // Commission % used
  final double vatRate;            // VAT % used (19%)

  FeeBreakdown({
    required this.customerPaid,
    required this.stripeFee,
    required this.commissionGross,
    required this.commissionNet,
    required this.commissionVat,
    required this.merchantTransfer,
    required this.platformNetRevenue,
    required this.commissionRate,
    required this.vatRate,
  });

  Map<String, dynamic> toMap() => {
    'customerPaid': customerPaid,
    'stripeFee': stripeFee,
    'commissionGross': commissionGross,
    'commissionNet': commissionNet,
    'commissionVat': commissionVat,
    'merchantTransfer': merchantTransfer,
    'platformNetRevenue': platformNetRevenue,
    'commissionRate': commissionRate,
    'vatRate': vatRate,
  };
}

/// Result of a payment attempt
class PaymentResult {
  final bool success;
  final String? paymentIntentId;
  final String? error;
  final bool wasCancelled;
  final FeeBreakdown? feeBreakdown;

  PaymentResult({
    required this.success,
    this.paymentIntentId,
    this.error,
    this.wasCancelled = false,
    this.feeBreakdown,
  });
}
