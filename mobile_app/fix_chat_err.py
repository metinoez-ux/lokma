with open("lib/screens/orders/order_chat_screen.dart", "r") as f:
    content = f.read()

content = content.replace(
"""                if (snapshot.connectionState == ConnectionState.waiting) {""",
"""                if (snapshot.hasError) {
                  print('Chat stream error: ${snapshot.error}');
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, color: Colors.red, size: 48),
                        const SizedBox(height: 16),
                        Text('Mesajlar yüklenemedi: ${snapshot.error}', style: const TextStyle(color: Colors.red)),
                      ],
                    ),
                  );
                }
                if (snapshot.connectionState == ConnectionState.waiting) {""")

with open("lib/screens/orders/order_chat_screen.dart", "w") as f:
    f.write(content)
