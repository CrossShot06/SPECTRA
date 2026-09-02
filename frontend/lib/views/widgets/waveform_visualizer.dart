import 'package:flutter/material.dart';

class WaveformVisualizer extends StatelessWidget {
  final List<double> amplitudes;
  final double riskLevel;

  const WaveformVisualizer({
    super.key,
    required this.amplitudes,
    required this.riskLevel,
  });

  Color _getColor(double val) {
    if (val < 0.40) return const Color(0xFF00F0FF);
    if (val <= 0.70) return const Color(0xFFFFB800);
    return const Color(0xFFFF0055);
  }

  @override
  Widget build(BuildContext context) {
    final activeColor = _getColor(riskLevel);

    return SizedBox(
      height: 48,
      child: CustomPaint(
        painter: _WaveformPainter(amplitudes: amplitudes, color: activeColor),
        size: const Size(double.infinity, 48),
      ),
    );
  }
}

class _WaveformPainter extends CustomPainter {
  final List<double> amplitudes;
  final Color color;

  _WaveformPainter({required this.amplitudes, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final count = amplitudes.length;
    final totalSpacing = size.width / count;
    final barWidth = totalSpacing * 0.55;

    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = barWidth;

    for (int i = 0; i < count; i++) {
      final x = i * totalSpacing + (barWidth / 2);
      final height = (amplitudes[i] * size.height).clamp(4.0, size.height);
      final top = (size.height - height) / 2;
      canvas.drawLine(Offset(x, top), Offset(x, top + height), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _WaveformPainter old) => true;
}