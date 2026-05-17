// Smoke test for a self-contained leaf widget.
//
// The previous default-template test referenced a non-existent `MyApp`
// counter widget (left over from `flutter create`) and broke `flutter test`
// / `flutter analyze`. It is replaced here with a minimal valid widget test.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bigbike_mobile/core/widgets/status_badge.dart';

void main() {
  testWidgets('StatusBadge renders its label', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: StatusBadge(label: 'Còn bảo hành', color: Colors.green),
        ),
      ),
    );

    expect(find.text('Còn bảo hành'), findsOneWidget);
  });
}
