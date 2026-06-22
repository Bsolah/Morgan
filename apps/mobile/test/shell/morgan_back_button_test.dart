import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:morgan_mobile/core/theme/morgan_theme.dart';
import 'package:morgan_mobile/shared/widgets/morgan_back_button.dart';

void main() {
  testWidgets('MorganBackButton pops when stack allows', (tester) async {
    late GoRouter router;

    router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => context.push('/detail'),
                child: const Text('Open'),
              ),
            ),
          ),
          routes: [
            GoRoute(
              path: 'detail',
              builder: (context, state) => const Scaffold(
                body: MorganBackButton(),
              ),
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(
        theme: MorganTheme.dark(),
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.byType(MorganBackButton), findsOneWidget);

    await tester.tap(find.byType(MorganBackButton));
    await tester.pumpAndSettle();
    expect(find.text('Open'), findsOneWidget);
  });
}
