import 'package:flutter/material.dart';

class Dummy {
  Widget _buildBakeryCard(String id, Map<String, dynamic> data) {
    return GestureDetector(
      onTap: () {},
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    SizedBox(
                      height: 180,
                      width: double.infinity,
                      child: Container(),
                    ),
                    if (true)
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.4),
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(12),
                              topRight: Radius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    if (true)
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100.withOpacity(0.9),
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(12),
                              topRight: Radius.circular(12),
                            ),
                          ),
                          child: Center(
                            child: Text(
                              'Kapalı',
                              style: TextStyle(
                                color: Colors.black87,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (true)
                      Positioned(
                        left: 12,
                        bottom: 12,
                        child: Opacity(
                          opacity: 1.0,
                          child: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Container(),
                            ),
                          ),
                        ),
                      ),
                    if (true)
                      Positioned(
                        left: 12,
                        top: 12,
                        child: Opacity(
                          opacity: 1.0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: Color(0xFFFB335B),
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.star, color: Colors.white, size: 14),
                                const SizedBox(width: 4),
                                const Text(
                                  'TUNA',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.9),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.favorite_border,
                          size: 20,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                  ],
                ),
                Builder(
                  builder: (context) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Name',
                            style: TextStyle(
                              color: Colors.black,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.star,
                                      color: Colors.amber, size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    '4.5',
                                    style: TextStyle(
                                      color: Colors.black.withOpacity(0.9),
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '(100)',
                                    style: TextStyle(
                                      color: Colors.black.withOpacity(0.9),
                                      fontSize: 15,
                                      fontWeight: FontWeight.w400,
                                    ),
                                  ),
                                  Text(
                                    ' · ',
                                    style: TextStyle(
                                        color: Colors.black.withOpacity(0.9),
                                        fontSize: 15),
                                  ),
                                  Expanded(
                                    child: Text(
                                      'Bakery',
                                      style: TextStyle(
                                        color: Colors.black.withOpacity(0.9),
                                        fontSize: 15,
                                        fontWeight: FontWeight.w400,
                                      ),
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
                                            color:
                                                Colors.black.withOpacity(0.9),
                                            size: 16),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Ücretsiz',
                                          style: TextStyle(
                                              color:
                                                  Colors.black.withOpacity(0.9),
                                              fontSize: 15),
                                        ),
                                        Text(' · ',
                                            style: TextStyle(
                                                color: Colors.black
                                                    .withOpacity(0.9),
                                                fontSize: 15)),
                                        Icon(Icons.shopping_basket_outlined,
                                            color:
                                                Colors.black.withOpacity(0.9),
                                            size: 16),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Min. 10 ₺',
                                          style: TextStyle(
                                            color:
                                                Colors.black.withOpacity(0.9),
                                            fontSize: 15,
                                            fontWeight: FontWeight.w400,
                                          ),
                                        ),
                                      ],
                                    );
                                  } else {
                                    return Row(
                                      children: [
                                        Icon(Icons.location_on_outlined,
                                            color:
                                                Colors.black.withOpacity(0.9),
                                            size: 16),
                                        const SizedBox(width: 4),
                                        Text(
                                          '—',
                                          style: TextStyle(
                                            color:
                                                Colors.black.withOpacity(0.9),
                                            fontSize: 15,
                                            fontWeight: FontWeight.w400,
                                          ),
                                        ),
                                      ],
                                    );
                                  }
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
