// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:aegis/screens/aegis_app.dart';
import 'package:aegis/features/mobile/pilot_view_screen.dart';

void main() {
  testWidgets('Aegis app loads without crashing', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ProviderScope(child: MaterialApp(home: PilotViewScreen())),
    );

    // Verify that our app loads
    expect(find.text('Aegis'), findsOneWidget);
  });
}
