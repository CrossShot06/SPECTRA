import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/detection_result.dart';
import '../state/call_guardian_state.dart';
import 'threat_ledger_screen.dart';
import 'widgets/risk_gauge.dart';
import 'widgets/waveform_visualizer.dart';

class ActiveCallScreen extends ConsumerWidget {
  final String callerName;
  final String callerNumber;
  final String backendWsUrl;

  const ActiveCallScreen({
    super.key,
    this.callerName = 'Unknown Exec / Wire Desk',
    this.callerNumber = '+91 98450 11234',
    this.backendWsUrl = 'ws://10.0.2.2:8000/ws/stream',
  });

  String _formatDuration(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(callGuardianProvider);
    final notifier = ref.read(callGuardianProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(0xFF050505), // Deep pure black base
      body: Stack(
        children: [
          // Background ambient abstract shapes for glass refraction
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.03),
              ),
            ),
          ),
          Positioned(
            bottom: 100,
            right: -150,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.grey.withOpacity(0.04),
              ),
            ),
          ),
          // Blur layer for ambient background
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
            child: Container(color: Colors.transparent),
          ),
          
          // Main UI Content
          SafeArea(
            child: Column(
              children: [
                _buildTopAppBar(context, state),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        children: [
                          const SizedBox(height: 16),
                          _buildCallerMetadataCard(state.callDurationSeconds),
                          const SizedBox(height: 32),
                          
                          // Sensor Display Module
                          _GlassContainer(
                            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                            child: Column(
                              children: [
                                WaveformVisualizer(
                                  amplitudes: state.waveformAmplitudes,
                                  riskLevel: state.currentResult.riskLevel,
                                ),
                                const SizedBox(height: 32),
                                RiskGauge(riskLevel: state.currentResult.riskLevel),
                                const SizedBox(height: 24),
                                _buildThreatStatusBadge(state.currentResult),
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 32),
                          _buildCallActionRow(notifier, state),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Critical Threat Modal Overlay
          if (state.threatModalActive)
            _buildCriticalThreatOverlay(context, notifier, state.currentResult.riskLevel),
        ],
      ),
    );
  }

  Widget _buildTopAppBar(BuildContext context, CallGuardianState state) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassContainer(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            borderRadius: 30,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: state.isRecording ? Colors.white : Colors.grey[700],
                    boxShadow: state.isRecording 
                        ? [const BoxShadow(color: Colors.white, blurRadius: 8)]
                        : [],
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  state.isRecording ? 'LIVE INTERCEPT' : 'STANDBY',
                  style: TextStyle(
                    color: state.isRecording ? Colors.white : Colors.grey[500],
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.history_rounded, color: Colors.white70),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ThreatLedgerScreen()),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCallerMetadataCard(int durationSec) {
    return _GlassContainer(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.person_outline_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  callerName,
                  style: const TextStyle(
                    color: Colors.white, 
                    fontSize: 17, 
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  callerNumber,
                  style: const TextStyle(
                    color: Colors.white54, 
                    fontSize: 13, 
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black45,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Text(
              _formatDuration(durationSec),
              style: const TextStyle(
                color: Colors.white,
                fontFamily: 'monospace',
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThreatStatusBadge(DetectionResult result) {
    String label;
    IconData icon;
    Color iconColor;

    switch (result.verdict) {
      case DetectionVerdict.criticalSpoof:
        label = 'SYNTHETIC VOICE DETECTED';
        icon = Icons.warning_amber_rounded;
        iconColor = const Color(0xFFFF0055);
        break;
      case DetectionVerdict.warning:
        label = 'ANOMALY SUSPECTED';
        icon = Icons.info_outline;
        iconColor = const Color(0xFFFFB800);
        break;
      case DetectionVerdict.genuine:
      default:
        label = 'VERIFIED HUMAN SPEECH';
        icon = Icons.verified_user_outlined;
        iconColor = const Color(0xFF00F0FF);
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: iconColor, size: 14),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCallActionRow(CallGuardianNotifier notifier, CallGuardianState state) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildGlassCircleAction(
              icon: state.isMuted ? Icons.mic_off_rounded : Icons.mic_none_rounded,
              label: 'Mute',
              isActive: state.isMuted,
              onTap: notifier.toggleMute,
            ),
            _buildGlassCircleAction(
              icon: state.isRecording ? Icons.close_rounded : Icons.fingerprint_rounded,
              label: state.isRecording ? 'End Audit' : 'Start Audit',
              isPrimary: true,
              isActive: state.isRecording,
              onTap: () {
                if (state.isRecording) {
                  notifier.endCallSession(callerNumber);
                } else {
                  notifier.startCallSession(backendWsUrl);
                }
              },
            ),
            _buildGlassCircleAction(
              icon: state.isSpeaker ? Icons.volume_up_rounded : Icons.volume_down_rounded,
              label: 'Speaker',
              isActive: state.isSpeaker,
              onTap: notifier.toggleSpeaker,
            ),
          ],
        ),
        const SizedBox(height: 32),
        Row(
          children: [
            Expanded(
              child: _GlassButton(
                icon: Icons.password_rounded,
                label: 'Secondary OTP',
                onTap: () {},
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _GlassButton(
                icon: Icons.block_rounded,
                label: 'Freeze Wire',
                isDestructive: true,
                onTap: () {},
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildGlassCircleAction({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
    bool isPrimary = false,
  }) {
    return Column(
      children: [
        GestureDetector(
          onTap: onTap,
          child: _GlassContainer(
            borderRadius: 40,
            padding: const EdgeInsets.all(18),
            backgroundColor: isPrimary 
                ? (isActive ? Colors.white : Colors.white.withOpacity(0.15))
                : (isActive ? Colors.white.withOpacity(0.2) : Colors.white.withOpacity(0.05)),
            child: Icon(
              icon,
              color: isPrimary && isActive ? Colors.black : Colors.white,
              size: 26,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label, 
          style: const TextStyle(
            color: Colors.white54, 
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildCriticalThreatOverlay(BuildContext context, CallGuardianNotifier notifier, double riskLevel) {
    return Stack(
      children: [
        BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Container(color: Colors.black.withOpacity(0.7)),
        ),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: _GlassContainer(
              borderColor: const Color(0xFFFF0055).withOpacity(0.5),
              backgroundColor: const Color(0xFFFF0055).withOpacity(0.1),
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.warning_rounded, color: Color(0xFFFF0055), size: 56),
                  const SizedBox(height: 24),
                  const Text(
                    'AI IMPERSONATION DETECTED',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Synthetic confidence at ${(riskLevel * 100).toInt()}%. Do not approve funds, wire transfers, or sensitive corporate access.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () => notifier.endCallSession(callerNumber),
                      child: const Text(
                        'TERMINATE CALL',
                        style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.0),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: notifier.dismissThreatModal,
                    child: const Text(
                      'Acknowledge & Monitor', 
                      style: TextStyle(color: Colors.white54, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// --- Reusable Glassmorphism Components ---

class _GlassContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color? backgroundColor;
  final Color? borderColor;

  const _GlassContainer({
    required this.child,
    this.padding = EdgeInsets.zero,
    this.borderRadius = 16.0,
    this.backgroundColor,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: backgroundColor ?? Colors.white.withOpacity(0.06),
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: borderColor ?? Colors.white.withOpacity(0.12),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isDestructive;

  const _GlassButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassContainer(
        padding: const EdgeInsets.symmetric(vertical: 16),
        backgroundColor: isDestructive 
            ? const Color(0xFFFF0055).withOpacity(0.1) 
            : Colors.white.withOpacity(0.05),
        borderColor: isDestructive 
            ? const Color(0xFFFF0055).withOpacity(0.3) 
            : Colors.white.withOpacity(0.12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon, 
              color: isDestructive ? const Color(0xFFFF0055) : Colors.white70, 
              size: 18,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isDestructive ? const Color(0xFFFF0055) : Colors.white70,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}