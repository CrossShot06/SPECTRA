import 'dart:convert';

enum DetectionVerdict { genuine, warning, criticalSpoof }

class DetectionResult {
  final int timestamp;
  final double score;
  final DetectionVerdict verdict;
  final double riskLevel;
  final int inferenceTimeMs;

  const DetectionResult({
    required this.timestamp,
    required this.score,
    required this.verdict,
    required this.riskLevel,
    required this.inferenceTimeMs,
  });

  factory DetectionResult.fromJson(Map<String, dynamic> json) {
    DetectionVerdict parseVerdict(String val) {
      switch (val.toUpperCase()) {
        case 'CRITICAL_SPOOF':
          return DetectionVerdict.criticalSpoof;
        case 'WARNING':
          return DetectionVerdict.warning;
        case 'GENUINE':
        default:
          return DetectionVerdict.genuine;
      }
    }

    return DetectionResult(
      timestamp: json['timestamp'] as int? ?? DateTime.now().millisecondsSinceEpoch ~/ 1000,
      score: (json['score'] as num?)?.toDouble() ?? 0.0,
      verdict: parseVerdict(json['verdict'] as String? ?? 'GENUINE'),
      riskLevel: (json['risk_level'] as num?)?.toDouble() ?? 0.0,
      inferenceTimeMs: json['inference_time_ms'] as int? ?? 0,
    );
  }

  factory DetectionResult.initial() => const DetectionResult(
        timestamp: 0,
        score: 1.0,
        verdict: DetectionVerdict.genuine,
        riskLevel: 0.0,
        inferenceTimeMs: 0,
      );
}

class CallAuditLog {
  final String id;
  final String callerId;
  final DateTime timestamp;
  final double peakRisk;
  final DetectionVerdict finalVerdict;
  final Duration callDuration;

  CallAuditLog({
    required this.id,
    required this.callerId,
    required this.timestamp,
    required this.peakRisk,
    required this.finalVerdict,
    required this.callDuration,
  });
}