import 'package:flutter/material.dart';

/// Isolated distance slider widget that manages its own state
/// Prevents parent widget rebuilds during slider drag
class DistanceSlider extends StatefulWidget {
  final double initialValue;
  final double min;
  final double max;
  final int divisions;
  final Color accentColor;
  final ValueChanged<double> onValueChanged;

  const DistanceSlider({
    super.key,
    required this.initialValue,
    this.min = 5,
    this.max = 100,
    this.divisions = 19,
    required this.accentColor,
    required this.onValueChanged,
  });

  @override
  State<DistanceSlider> createState() => _DistanceSliderState();
}

class _DistanceSliderState extends State<DistanceSlider> {
  late double _currentValue;

  @override
  void initState() {
    super.initState();
    _currentValue = widget.initialValue;
  }

  @override
  void didUpdateWidget(DistanceSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialValue != widget.initialValue) {
      _currentValue = widget.initialValue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.navigation, color: widget.accentColor, size: 20),
        const SizedBox(width: 12),
        const Text(
          'Mesafe:',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        Expanded(
          child: SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: Colors.grey.shade900,
              inactiveTrackColor: Colors.grey.shade800,
              thumbColor: widget.accentColor,
              overlayColor: widget.accentColor.withValues(alpha: 0.2),
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
            ),
            child: Slider(
              value: _currentValue,
              min: widget.min,
              max: widget.max,
              // No divisions - smooth continuous sliding
              onChanged: (value) {
                // Local state update - doesn't trigger parent rebuild
                setState(() => _currentValue = value);
              },
              onChangeEnd: (value) {
                // Only callback to parent when user releases
                widget.onValueChanged(value);
              },
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: widget.accentColor,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: widget.accentColor.withValues(alpha: 0.4),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            '${_currentValue.toInt()} km',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }
}
