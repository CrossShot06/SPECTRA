import { Activity, Clock, Gauge, Radio } from 'lucide-react';

/**
 * TelemetryGrid — Four metric cards for the SOC dashboard.
 * Displays: Session ID, Live Risk Score, Processing Latency, Packet Rate.
 */
export default function TelemetryGrid({ telemetry, isConnected }) {
  const { session_id, risk_score, latency_ms, status } = telemetry;

  // Simulate packet rate from latency
  const packetRate = isConnected ? Math.round(1000 / Math.max(latency_ms, 1)) : 0;

  const riskColor =
    risk_score >= 0.6
      ? 'text-spectra-crimson'
      : risk_score >= 0.3
      ? 'text-spectra-amber'
      : 'text-spectra-emerald';

  const riskGlow =
    risk_score >= 0.6
      ? 'glow-crimson'
      : risk_score >= 0.3
      ? 'glow-amber'
      : '';

  const cards = [
    {
      label: 'SESSION',
      value: session_id || '—',
      sub: status,
      icon: Radio,
      color: 'text-spectra-slate',
    },
    {
      label: 'RISK SCORE',
      value: (risk_score * 100).toFixed(1) + '%',
      sub: risk_score >= 0.6 ? 'CRITICAL' : risk_score >= 0.3 ? 'ELEVATED' : 'NOMINAL',
      icon: Gauge,
      color: riskColor,
      glow: riskGlow,
    },
    {
      label: 'LATENCY',
      value: latency_ms + 'ms',
      sub: latency_ms > 150 ? 'DEGRADED' : 'OPTIMAL',
      icon: Clock,
      color: latency_ms > 150 ? 'text-spectra-amber' : 'text-spectra-emerald',
    },
    {
      label: 'PKT RATE',
      value: packetRate + '/s',
      sub: isConnected ? 'STREAMING' : 'HALTED',
      icon: Activity,
      color: isConnected ? 'text-spectra-emerald' : 'text-spectra-crimson',
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`card-surface p-3.5 flex flex-col gap-2 ${card.glow || ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-medium tracking-[0.15em] text-spectra-slate uppercase">
              {card.label}
            </span>
            <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
          </div>
          <div className={`text-xl font-mono font-semibold font-tabular ${card.color} leading-none`}>
            {card.value}
          </div>
          <div className="text-[10px] font-mono text-spectra-slate/70 tracking-wide">
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
