import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import 'brief_formatters.dart';
import 'brief_repository.dart';

class BriefShareService {
  String toPlainText(DailyBrief brief) {
    final buffer = StringBuffer()
      ..writeln('Morgan Daily Brief')
      ..writeln(formatBriefingDateLabel(brief))
      ..writeln()
      ..writeln(brief.headline)
      ..writeln()
      ..writeln(brief.narrative);

    if (brief.kpiDeltas.isNotEmpty) {
      buffer.writeln('\nKey metrics');
      for (final delta in brief.kpiDeltas) {
        buffer.writeln('- ${delta.label}: ${formatKpiValue(delta)} (${formatKpiDelta(delta) ?? 'flat'})');
      }
    }

    final action = brief.topAction;
    if (action != null) {
      buffer
        ..writeln('\nTop action')
        ..writeln(action.title)
        ..writeln(action.body);
    }

    return buffer.toString().trim();
  }

  Future<Uint8List> toPdfBytes(DailyBrief brief) async {
    final doc = pw.Document();
    final text = toPlainText(brief);

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (context) => [
          pw.Text(
            'Morgan Daily Brief',
            style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.Text(formatBriefingDateLabel(brief), style: const pw.TextStyle(fontSize: 12)),
          pw.SizedBox(height: 20),
          pw.Text(text, style: const pw.TextStyle(fontSize: 11)),
        ],
      ),
    );

    return doc.save();
  }

  Future<void> shareAsText(DailyBrief brief) async {
    await Share.share(toPlainText(brief), subject: brief.headline);
  }

  Future<void> shareAsPdf(DailyBrief brief) async {
    final bytes = await toPdfBytes(brief);
    final safeDate = brief.date.isEmpty
        ? DateFormat('yyyy-MM-dd').format(DateTime.now())
        : brief.date;
    final file = XFile.fromData(
      bytes,
      mimeType: 'application/pdf',
      name: 'morgan-brief-$safeDate.pdf',
    );
    await Share.shareXFiles([file], subject: brief.headline, text: brief.headline);
  }
}

final briefShareServiceProvider = Provider<BriefShareService>((ref) => BriefShareService());
