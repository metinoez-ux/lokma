import 'package:flutter_test/flutter_test.dart';
import 'package:lokma_app/main.dart';

void main() {
  testWidgets('LOKMA app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const LokmaApp());

    // Verify that LOKMA title is displayed
    expect(find.text('LOKMA'), findsOneWidget);
  });
}
