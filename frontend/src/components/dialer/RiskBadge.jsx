import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

/**
 * RiskBadge — Real-time state indicator for voice authenticity.
 *
 * States:
 *   risk < 0.30  → AUTHENTIC (emerald)
 *   risk < 0.60  → SUSPICIOUS (amber)
 *   risk >= 0.60 → SPOOFED (crimson, pulsing)
 */
export default function RiskBadge({ riskScore = 0, status = 'IDLE' }) {
  const isIdle = status === 'IDLE';

  let label, color, bgTint, Icon, shouldPulse;

  if (isIdle) {
    label = 'IDLE';
    color = 'text-spectra-slate';
    bgTint = 'bg-spectra-slate/10';
    Icon = ShieldCheck;
    shouldPulse = false;
  } else if (riskScore < 0.3) {
    label = 'AUTHENTIC';
    color = 'text-spectra-emerald';
    bgTint = 'bg-spectra-emerald/10';
    Icon = ShieldCheck;
    shouldPulse = false;
  } else if (riskScore < 0.6) {
    label = 'SUSPICIOUS';
    color = 'text-spectra-amber';
    bgTint = 'bg-spectra-amber/10';
    Icon = ShieldAlert;
    shouldPulse = false;
  } else {
    label = 'SPOOFED';
    color = 'text-spectra-crimson';
    bgTint = 'bg-spectra-crimson/10';
    Icon = ShieldX;
    shouldPulse = true;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${bgTint} ${
        shouldPulse
          ? 'border-spectra-crimson/40 border-pulse-crimson'
          : 'border-transparent'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span
        className={`text-[11px] font-mono font-semibold tracking-widest ${color}`}
      >
        {label}
      </span>
      {!isIdle && (
        <span className={`text-[10px] font-mono font-tabular ${color} ml-1`}>
          {(riskScore * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
