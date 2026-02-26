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
                  ],
                ),
                Builder(
                  builder: (context) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('name'),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.star),
                                ],
                              ),
                              Builder(
                                builder: (context) {
                                  if (true) {
                                    return Row(
                                      children: [
                                        Icon(Icons.directions_bike),
                                      ],
                                    );
                                  } else {
                                    return Row(
                                      children: [
                                        Icon(Icons.location_on_outlined),
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
