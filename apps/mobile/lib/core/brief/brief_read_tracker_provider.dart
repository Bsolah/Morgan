import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'brief_read_tracker.dart';

final briefReadTrackerProvider = FutureProvider<BriefReadTracker>((ref) async {
  return BriefReadTracker.create();
});
