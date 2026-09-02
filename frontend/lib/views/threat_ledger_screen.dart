import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/detection_result.dart';
import '../state/call_guardian_state.dart';

class ThreatLedgerScreen extends ConsumerWidget {
  const ThreatLedgerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auditLogs = ref.watch(callGuardianProvider).auditLogs;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        title: const Text('Threat Ledger', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF161D2F),
        elevation: 0,
      ),
      body: auditLogs.isEmpty
          ? const Center(
              child: Text(
                'No intercepted calls recorded yet.',
                style: TextStyle(color: Colors.white38),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: auditLogs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final log = auditLogs[i];
                final isThreat = log.peakRisk > 0.70;
                final badgeColor = isThreat ? const Color(0xFFFF0055) : const Color(0xFF00F0FF);

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF161D2F),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.06)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: badgeColor.withOpacity(0.15),
                        child: Icon(
                          isThreat ? Icons.gpp_bad : Icons.verified_user,
                          color: badgeColor,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              log.callerId,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              DateFormat('dd MMM yyyy, HH:mm').format(log.timestamp),
                              style: const TextStyle(color: Colors.white38, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Peak: ${(log.peakRisk * 100).toInt()}%',
                            style: TextStyle(
                              color: badgeColor,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${log.callDuration.inSeconds}s session',
                            style: const TextStyle(color: Colors.white30, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}