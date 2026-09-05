import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TelemetryGrid from '@/components/dashboard/TelemetryGrid';
import RiskChart from '@/components/dashboard/RiskChart';
import BreakdownBars from '@/components/dashboard/BreakdownBars';
import IncidentActions from '@/components/dashboard/IncidentActions';

/**
 * FraudDashboard — Dense multi-column enterprise SOC operations screen.
 */
export default function FraudDashboard({
  telemetry,
  riskHistory,
  isConnected,
  latencyMs,
  onReconnect,
}) {
  const navigate = useNavigate();
  const { session_id, risk_score, breakdown, status, source } = telemetry;

  const SOURCE_LABELS = {
    twilio_pstn:  '📞 PSTN Call',
    webrtc_peer:  '💻 In-App Call',
    browser_mic:  '💻 In-App Call',
  };
  const sourceLabel = SOURCE_LABELS[source] ?? '🔲 Unknown Source';

  const riskLevel =
    risk_score >= 0.6
      ? { label: 'CRITICAL', color: 'text-spectra-crimson', bg: 'bg-spectra-crimson/5' }
      : risk_score >= 0.3
      ? { label: 'ELEVATED', color: 'text-spectra-amber', bg: 'bg-spectra-amber/5' }
      : { label: 'NOMINAL', color: 'text-spectra-emerald', bg: 'bg-spectra-emerald/5' };

  return (
    <div className="min-h-[calc(100vh-44px)] p-4 lg:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-[11px] font-mono text-spectra-slate hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            HUB
          </button>
          <div className="h-4 w-px bg-spectra-border" />
          <h1 className="text-[12px] font-mono font-semibold tracking-[0.15em] text-white/80 uppercase">
            SOC Operations — Voice Fraud Detection
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold tracking-wider ${riskLevel.color} ${riskLevel.bg} border border-current/20`}
          >
            THREAT LEVEL: {riskLevel.label}
          </div>
          <button
            onClick={onReconnect}
            className="p-1.5 rounded border border-spectra-border hover:border-spectra-border-bright text-spectra-slate hover:text-white transition-colors cursor-pointer"
            title="Reconnect telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Telemetry cards */}
      <div className="mb-4">
        <TelemetryGrid telemetry={telemetry} isConnected={isConnected} />
      </div>

      {/* Main grid: chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — Risk chart (spans 2 cols on large screens) */}
        <div className="lg:col-span-2">
          <RiskChart riskHistory={riskHistory} />
        </div>

        {/* Right column — Breakdown + Actions */}
        <div className="flex flex-col gap-4">
          <BreakdownBars breakdown={breakdown} />
          <IncidentActions sessionId={session_id} riskScore={risk_score} />
        </div>
      </div>

      {/* Status footer */}
      <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-spectra-slate/40 tracking-wider">
        <span>
          SESSION: {session_id}
          {' — '}
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider border border-spectra-border text-spectra-slate/70"
          >
            {sourceLabel}
          </span>
          {' — '}{status}
        </span>
        <span>
          SOCKET: {isConnected ? 'CONNECTED' : 'DISCONNECTED'} — LATENCY:{' '}
          {latencyMs}ms
        </span>
      </div>
    </div>
  );
}
