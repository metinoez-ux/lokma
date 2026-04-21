import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web - '
        'you can reconfigure this by running the FlutterFire CLI again.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for macos - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  // LOKMA iOS Firebase configuration
  // Values from ios/Runner/GoogleService-Info.plist
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyA-GSWm0DtaagUw5tvO4kTv085du53j_Wk',
    appId: '1:259070566992:ios:ef88784b6d6192e71e2755',
    messagingSenderId: '259070566992',
    projectId: 'aylar-a45af',
    storageBucket: 'aylar-a45af.firebasestorage.app',
    iosBundleId: 'shop.lokma.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDm92A_RuTIj85tFR0LKQo80A6aTgBffgA',
    appId: '1:259070566992:android:946417324a9025d21e2755',
    messagingSenderId: '259070566992',
    projectId: 'aylar-a45af',
    storageBucket: 'aylar-a45af.firebasestorage.app',
  );
}
