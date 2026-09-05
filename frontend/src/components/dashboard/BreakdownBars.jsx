import { AudioLines, Brain, Fingerprint } from 'lucide-react';

/**
 * BreakdownBars — Spectral / Prosody / Identity confidence breakdown sliders.
 * Each bar shows a 0–100% fill with color intensity mapped to the score.
 */
export default function BreakdownBars({ breakdown = {} }) {
  const { spectral = 0, prosody = 0, identity = 0 } = breakdown;

  const metrics = [
    {
      label: 'Spectral Inconsistency',
      value: spectral,
      icon: AudioLines,
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.08)',
    },
    {
      label: 'Prosodic Anomaly',
      value: prosody,
      icon: Brain,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.08)',
    },
    {
      label: 'Biometric Speaker Match',
      value: identity,
      icon: Fingerprint,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      invert: true, // Higher = better for identity match
    },
  ];

  return (
    <div className="card-surface p-4">
      <h3 className="text-[11px] font-mono font-medium tracking-[0.15em] text-spectra-slate uppercase mb-4">
        Diagnostic Breakdown
      </h3>
      <div className="flex flex-col gap-4">
        {metrics.map((m) => {
          const percent = (m.value * 100).toFixed(1);
          const barWidth = `${m.value * 100}%`;

          // For identity, high = good (green), for others, high = bad
          const severity = m.invert
            ? m.value < 0.4
              ? 'CRITICAL'
              : m.value < 0.7
              ? 'WARNING'
              : 'NOMINAL'
            : m.value >= 0.6
            ? 'CRITICAL'
            : m.value >= 0.3
            ? 'ELEVATED'
            : 'NOMINAL';

          return (
            <div key={m.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <m.icon
                    className="w-3.5 h-3.5"
                    style={{ color: m.color }}
                  />
                  <span className="text-[11px] font-medium text-white/80">
                    {m.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-spectra-slate tracking-wide">
                    {severity}
                  </span>
                  <span
                    className="text-[12px] font-mono font-semibold font-tabular"
                    style={{ color: m.color }}
                  >
                    {percent}%
                  </span>
                </div>
              </div>
              {/* Bar track */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: m.bgColor }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: barWidth,
                    background: m.color,
                    boxShadow: `0 0 8px ${m.color}40`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
