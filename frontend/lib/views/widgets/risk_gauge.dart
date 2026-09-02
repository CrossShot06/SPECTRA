import 'dart:math';
import 'package:flutter/material.dart';

class RiskGauge extends StatelessWidget {
  final double riskLevel; // 0.0 to 1.0

  const RiskGauge({super.key, required this.riskLevel});

  Color _getColor(double val) {
    if (val < 0.40) return const Color(0xFF00F0FF); // Cyan
    if (val <= 0.70) return const Color(0xFFFFB800); // Amber
    return const Color(0xFFFF0055); // Crimson
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: riskLevel),
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
      builder: (context, animatedVal, _) {
        final color = _getColor(animatedVal);
        final percent = (animatedVal * 100).toInt();

        return SizedBox(
          width: 200,
          height: 200,
          child: CustomPaint(
            painter: _GaugePainter(value: animatedVal, trackColor: color),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$percent%',
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 42,
                      fontWeight: FontWeight.w900,
                      color: color,
                      shadows: [
                        Shadow(color: color.withOpacity(0.5), blurRadius: 16),
                      ],
                    ),
                  ),
                  const Text(
                    'SPOOF RISK',
                    style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 2.0,
                      fontWeight: FontWeight.bold,
                      color: Colors.white54,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _GaugePainter extends CustomPainter {
  final double value;
  final Color trackColor;

  _GaugePainter({required this.value, required this.trackColor});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 14;
    const startAngle = 0.75 * pi;
    const sweepTotal = 1.5 * pi;

    // Background track
    final bgPaint = Paint()
      ..color = Colors.white.withOpacity(0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), startAngle, sweepTotal, false, bgPaint);

    // Dynamic progress arc
    final activePaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepTotal * value.clamp(0.0, 1.0),
      false,
      activePaint,
    );
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) => old.value != value || old.trackColor != trackColor;
}