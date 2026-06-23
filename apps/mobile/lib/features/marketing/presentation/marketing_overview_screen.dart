import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import 'marketing_budget_tab.dart';
import 'marketing_mer_tab.dart';
import 'marketing_poas_tab.dart';

class MarketingOverviewScreen extends ConsumerStatefulWidget {
  const MarketingOverviewScreen({super.key});

  @override
  ConsumerState<MarketingOverviewScreen> createState() => _MarketingOverviewScreenState();
}

class _MarketingOverviewScreenState extends ConsumerState<MarketingOverviewScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const MorganDetailScreenHeader(
              title: 'Marketing',
              subtitle: 'POAS, MER, and budget reallocation',
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(text: 'POAS'),
                  Tab(text: 'MER'),
                  Tab(text: 'Budget'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: const [
                  MarketingPoasTab(),
                  MarketingMerTab(),
                  MarketingBudgetTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
