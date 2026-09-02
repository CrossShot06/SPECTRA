import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/detection_result.dart';
import '../services/audio_stream_service.dart';
import '../services/websocket_service.dart';

class CallGuardianState {
  final WsConnectionState connectionState;
  final bool isRecording;
  final bool isMuted;
  final bool isSpeaker;
  final DetectionResult currentResult;
  final double peakRisk;
  final int callDurationSeconds;
  final List<double> waveformAmplitudes;
  final bool threatModalActive;
  final List<CallAuditLog> auditLogs;

  const CallGuardianState({
    required this.connectionState,
    required this.isRecording,
    required this.isMuted,
    required this.isSpeaker,
    required this.currentResult,
    required this.peakRisk,
    required this.callDurationSeconds,
    required this.waveformAmplitudes,
    required this.threatModalActive,
    required this.auditLogs,
  });

  factory CallGuardianState.initial() => CallGuardianState(
        connectionState: WsConnectionState.disconnected,
        isRecording: false,
        isMuted: false,
        isSpeaker: false,
        currentResult: DetectionResult.initial(),
        peakRisk: 0.0,
        callDurationSeconds: 0,
        waveformAmplitudes: List.filled(24, 0.05),
        threatModalActive: false,
        auditLogs: [],
      );

  CallGuardianState copyWith({
    WsConnectionState? connectionState,
    bool? isRecording,
    bool? isMuted,
    bool? isSpeaker,
    DetectionResult? currentResult,
    double? peakRisk,
    int? callDurationSeconds,
    List<double>? waveformAmplitudes,
    bool? threatModalActive,
    List<CallAuditLog>? auditLogs,
  }) {
    return CallGuardianState(
      connectionState: connectionState ?? this.connectionState,
      isRecording: isRecording ?? this.isRecording,
      isMuted: isMuted ?? this.isMuted,
      isSpeaker: isSpeaker ?? this.isSpeaker,
      currentResult: currentResult ?? this.currentResult,
      peakRisk: peakRisk ?? this.peakRisk,
      callDurationSeconds: callDurationSeconds ?? this.callDurationSeconds,
      waveformAmplitudes: waveformAmplitudes ?? this.waveformAmplitudes,
      threatModalActive: threatModalActive ?? this.threatModalActive,
      auditLogs: auditLogs ?? this.auditLogs,
    );
  }
}

class CallGuardianNotifier extends StateNotifier<CallGuardianState> {
  final AudioStreamService _audioService = AudioStreamService();
  final WebSocketService _wsService = WebSocketService();
  Timer? _callTimer;
  StreamSubscription? _audioSub;
  StreamSubscription? _resultSub;
  StreamSubscription? _connSub;

  CallGuardianNotifier() : super(CallGuardianState.initial()) {
    _initStreams();
  }

  void _initStreams() {
    _connSub = _wsService.connectionState.listen((conn) {
      state = state.copyWith(connectionState: conn);
    });

    _resultSub = _wsService.results.listen((res) {
      final newPeak = max(state.peakRisk, res.riskLevel);
      final isCritical = res.riskLevel > 0.75 || res.verdict == DetectionVerdict.criticalSpoof;

      if (isCritical && !state.threatModalActive) {
        HapticFeedback.heavyImpact();
      }

      state = state.copyWith(
        currentResult: res,
        peakRisk: newPeak,
        threatModalActive: isCritical ? true : state.threatModalActive,
      );
    });
  }

  Future<void> startCallSession(String wsUrl) async {
    _wsService.connect(wsUrl);

    final micStarted = await _audioService.initializeAndStart();
    if (!micStarted) {
      return;
    }

    _audioSub = _audioService.audioStream.listen((bytes) {
      _wsService.sendAudioChunk(bytes);
      _updateWaveformFromBytes(bytes);
    });

    _callTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      state = state.copyWith(callDurationSeconds: state.callDurationSeconds + 1);
    });

    state = state.copyWith(isRecording: true, peakRisk: 0.0);
  }

  void _updateWaveformFromBytes(Uint8List bytes) {
    if (bytes.isEmpty) return;
    double sum = 0.0;
    final int16List = bytes.buffer.asInt16List();
    for (int i = 0; i < int16List.length; i += 64) {
      sum += (int16List[i]).abs();
    }
    final avg = (sum / (int16List.length / 64)) / 32768.0;
    final normalized = avg.clamp(0.05, 1.0);

    final updated = List<double>.from(state.waveformAmplitudes);
    updated.removeAt(0);
    updated.add(normalized);
    state = state.copyWith(waveformAmplitudes: updated);
  }

  void toggleMute() => state = state.copyWith(isMuted: !state.isMuted);
  void toggleSpeaker() => state = state.copyWith(isSpeaker: !state.isSpeaker);

  void dismissThreatModal() {
    state = state.copyWith(threatModalActive: false);
  }

  Future<void> endCallSession(String callerId) async {
    _callTimer?.cancel();
    await _audioSub?.cancel();
    await _audioService.stop();
    _wsService.disconnect();

    final log = CallAuditLog(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      callerId: callerId,
      timestamp: DateTime.now(),
      peakRisk: state.peakRisk,
      finalVerdict: state.currentResult.verdict,
      callDuration: Duration(seconds: state.callDurationSeconds),
    );

    state = state.copyWith(
      isRecording: false,
      callDurationSeconds: 0,
      threatModalActive: false,
      auditLogs: [log, ...state.auditLogs],
      currentResult: DetectionResult.initial(),
    );
  }

  @override
  void dispose() {
    _callTimer?.cancel();
    _audioSub?.cancel();
    _resultSub?.cancel();
    _connSub?.cancel();
    _audioService.dispose();
    _wsService.dispose();
    super.dispose();
  }
}

final callGuardianProvider = StateNotifierProvider<CallGuardianNotifier, CallGuardianState>((ref) {
  return CallGuardianNotifier();
});