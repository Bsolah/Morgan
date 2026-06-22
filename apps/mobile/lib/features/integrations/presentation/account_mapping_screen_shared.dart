import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_surface.dart';

class AccountMappingRow extends StatelessWidget {
  const AccountMappingRow({
    super.key,
    required this.accountName,
    required this.accountMeta,
    required this.selectedCategory,
    required this.categories,
    required this.categoryLabel,
    required this.onChanged,
    this.validationError,
  });

  final String accountName;
  final String accountMeta;
  final String? selectedCategory;
  final List<String> categories;
  final String Function(String category) categoryLabel;
  final ValueChanged<String?> onChanged;
  final String? validationError;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(accountName, style: theme.textTheme.titleSmall),
          if (accountMeta.isNotEmpty) ...[
            const SizedBox(height: MorganSpace.xxs),
            Text(accountMeta, style: theme.textTheme.bodySmall),
          ],
          const SizedBox(height: MorganSpace.sm),
          Text('Morgan category', style: theme.textTheme.labelSmall),
          const SizedBox(height: MorganSpace.xxs),
          DropdownButtonFormField<String>(
            value: selectedCategory,
            isExpanded: true,
            decoration: InputDecoration(
              errorText: validationError,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(MorganRadius.sm)),
            ),
            items: categories
                .map(
                  (category) => DropdownMenuItem(
                    value: category,
                    child: Text(categoryLabel(category)),
                  ),
                )
                .toList(),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

String? accountMappingValidationError(String? category, {required bool showValidation}) {
  if (!showValidation) return null;
  if (category == null || category.isEmpty || category == 'unmapped') {
    return 'Choose a Morgan category';
  }
  return null;
}
