import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/profile/notification_history_screen.dart');
  String content = file.readAsStringSync();
  
  // Custom regex to handle all variations we saw in grep
  // Like `(a['createdAt'] as Timestamp?)`
  // We want to replace `a['createdAt'] as Timestamp?` with `(a['createdAt'] is Timestamp ? a['createdAt'] as Timestamp : null)`
  
  // 1. (a['createdAt'] as Timestamp?) -> ((a['createdAt'] is Timestamp) ? a['createdAt'] : null)
  content = content.replaceAllMapped(RegExp(r"\(([\w\.\[\]\']+)\s+as\s+Timestamp\?\)"), (match) {
     final exp = match.group(1);
     return "(($exp is Timestamp) ? $exp /*cast*/ : null)";
  });
  
  // 2. a['createdAt'] as Timestamp? -> (a['createdAt'] is Timestamp ? a['createdAt'] : null)
  content = content.replaceAllMapped(RegExp(r"([\w\.\[\]\']+)\s+as\s+Timestamp\?"), (match) {
     final exp = match.group(1);
     return "($exp is Timestamp ? $exp /*cast*/ : null)";
  });
  
  file.writeAsStringSync(content);
  print('Done parsing notification_history_screen!');
}
