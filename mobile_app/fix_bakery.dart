import 'package:flutter/material.dart';

class Dummy {
  Widget _buildBakeryCard(String id, Map<String, dynamic> data) {
    return GestureDetector(
      onTap: () {},
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    SizedBox(),
                    if (true) Positioned.fill(child: Container()),
                    if (true)
                      Positioned(top: 0, left: 0, right: 0, child: Container()),
                    if (true)
                      Positioned(left: 12, bottom: 12, child: Container()),
                    if (true) Positioned(left: 12, top: 12, child: Container()),
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              'name',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.w600),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                                color: Colors.green,
                                borderRadius: BorderRadius.circular(4)),
                            child: Row(
                              children: [
                                const Icon(Icons.star,
                                    color: Colors.white, size: 14),
                                const SizedBox(width: 4),
                                Text('4.0',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.store, color: Colors.grey, size: 16),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Bakery',
                              style: TextStyle(
                                  color: Colors.grey,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w400),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Builder(
                        builder: (context) {
                          if (true) {
                            return Row(
                              children: [
                                Icon(Icons.directions_bike,
                                    color: Colors.grey, size: 16),
                                const SizedBox(width: 6),
                                Text('Ücretsiz',
                                    style: TextStyle(
                                        color: Colors.grey, fontSize: 15)),
                              ],
                            );
                          } else {
                            return Row(
                              children: [
                                Icon(Icons.location_on_outlined,
                                    color: Colors.grey, size: 16),
                                const SizedBox(width: 4),
                                Text('—',
                                    style: TextStyle(
                                        color: Colors.grey,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w400)),
                              ],
                            );
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
