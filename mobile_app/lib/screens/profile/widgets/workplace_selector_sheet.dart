import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../services/kermes_assignment_service.dart';
import 'package:easy_localization/easy_localization.dart';

class WorkplaceSelectorSheet extends StatelessWidget {
  final String? baseBusinessName;
  final List<KermesAssignment> kermeses;
  final Function(String id, String name, String type) onSelected;

  const WorkplaceSelectorSheet({
    super.key,
    required this.baseBusinessName,
    required this.kermeses,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: EdgeInsets.only(
        top: 24,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).padding.bottom + 20,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[800] : Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Bugün nerede görev alıyorsunuz?',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Lütfen giriş yapmak istediğiniz işletmeyi veya kermesi seçin.',
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 24),
          
          if (baseBusinessName != null) ...[
            _buildOption(
              context,
              icon: Icons.storefront_outlined,
              title: baseBusinessName!,
              subtitle: 'Restoran / İşletme',
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.pop(context);
                onSelected('', baseBusinessName!, 'restoran'); // Will clear override
              },
            ),
            const SizedBox(height: 12),
          ],
          
          ...kermeses.map((k) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildOption(
                  context,
                  icon: Icons.volunteer_activism_outlined,
                  title: k.title,
                  subtitle: 'Kermes',
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.pop(context);
                    onSelected(k.id, k.title, 'kermes');
                  },
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildOption(BuildContext context, {required IconData icon, required String title, required String subtitle, required VoidCallback onTap}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isDark ? null : Border.all(color: Colors.grey.shade200),
          boxShadow: isDark ? null : [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: Theme.of(context).primaryColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }
}
