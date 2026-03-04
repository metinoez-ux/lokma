import 'dart:math';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:share_plus/share_plus.dart';

/// Referral Service — Uber Eats style invite-a-friend system.
/// Each user gets a unique referral code. When a friend signs up
/// and completes their first order, both get wallet credit.
class ReferralService {
  static final _db = FirebaseFirestore.instance;
  static const double _referrerReward = 5.0;  // € for the inviter
  static const double _refereeReward = 5.0;   // € for the new user

  /// Generate a unique referral code for the user (called on sign-up)
  static Future<String> getOrCreateReferralCode(String userId) async {
    final userDoc = _db.collection('users').doc(userId);
    final snap = await userDoc.get();
    final data = snap.data();

    if (data != null && data['referralCode'] != null) {
      return data['referralCode'] as String;
    }

    // Generate unique code: LOKMA-XXXX
    final code = _generateCode();
    await userDoc.set({'referralCode': code}, SetOptions(merge: true));
    return code;
  }

  /// Apply a referral code during sign-up
  static Future<bool> applyReferralCode(String newUserId, String code) async {
    final normalizedCode = code.trim().toUpperCase();

    // Find the referrer
    final query = await _db
        .collection('users')
        .where('referralCode', isEqualTo: normalizedCode)
        .limit(1)
        .get();

    if (query.docs.isEmpty) return false;

    final referrerId = query.docs.first.id;
    if (referrerId == newUserId) return false; // Can't refer yourself

    // Mark the new user as referred
    await _db.collection('users').doc(newUserId).set({
      'referredBy': referrerId,
      'referredByCode': normalizedCode,
      'referralRewardPending': true,
    }, SetOptions(merge: true));

    return true;
  }

  /// Called after a referred user's first order delivery.
  /// Credits both wallets.
  static Future<void> processReferralReward(String userId) async {
    final userDoc = await _db.collection('users').doc(userId).get();
    final data = userDoc.data();
    if (data == null) return;

    // Check if pending and not already rewarded
    if (data['referralRewardPending'] != true) return;
    if (data['referralRewardGranted'] == true) return;

    final referrerId = data['referredBy'] as String?;
    if (referrerId == null) return;

    final batch = _db.batch();

    // Credit referrer (inviter)
    final referrerWalletRef = _db.collection('users').doc(referrerId);
    batch.set(referrerWalletRef, {
      'walletBalance': FieldValue.increment(_referrerReward),
    }, SetOptions(merge: true));

    // Log referrer transaction
    batch.set(
      _db.collection('users').doc(referrerId).collection('wallet_transactions').doc(),
      {
        'type': 'referral_reward',
        'amount': _referrerReward,
        'reason': 'Arkadaş daveti ödülü',
        'referredUserId': userId,
        'createdAt': FieldValue.serverTimestamp(),
      },
    );

    // Credit referee (new user)
    final refereeRef = _db.collection('users').doc(userId);
    batch.set(refereeRef, {
      'walletBalance': FieldValue.increment(_refereeReward),
      'referralRewardPending': false,
      'referralRewardGranted': true,
    }, SetOptions(merge: true));

    // Log referee transaction
    batch.set(
      _db.collection('users').doc(userId).collection('wallet_transactions').doc(),
      {
        'type': 'referral_welcome',
        'amount': _refereeReward,
        'reason': 'Hoş geldin indirimi',
        'referrerId': referrerId,
        'createdAt': FieldValue.serverTimestamp(),
      },
    );

    await batch.commit();
  }

  /// Share referral link via system share sheet
  static Future<void> shareReferralCode(BuildContext context) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final code = await getOrCreateReferralCode(user.uid);

    await Share.share(
      'LOKMA\'da ilk siparişine ${_refereeReward.toStringAsFixed(0)}€ indirim kazan! '
      'Davet kodum: $code\n\n'
      'https://lokma.app/invite/$code',
      subject: 'LOKMA\'ya katıl, ${_refereeReward.toStringAsFixed(0)}€ kazan!',
    );
  }

  /// Get referral stats for the profile
  static Future<Map<String, dynamic>> getReferralStats(String userId) async {
    final referrals = await _db
        .collection('users')
        .where('referredBy', isEqualTo: userId)
        .get();

    final completedReferrals = referrals.docs
        .where((d) => d.data()['referralRewardGranted'] == true)
        .length;

    return {
      'totalInvited': referrals.docs.length,
      'completedReferrals': completedReferrals,
      'totalEarned': completedReferrals * _referrerReward,
    };
  }

  static String _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
    final rng = Random.secure();
    final suffix = List.generate(4, (_) => chars[rng.nextInt(chars.length)]).join();
    return 'LOKMA-$suffix';
  }
}
