import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

/**
 * RiskChart — Real-time scrolling threat probability line chart.
 * Renders rolling risk_score over time with a red threshold line at y=0.60.
 */
export default function RiskChart({ riskHistory }) {
  // Format timestamp for X axis
  const formatted = riskHistory.map((d, i) => ({
    ...d,
    label: new Date(d.time).toLocaleTimeString('en-US', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
    idx: i,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="card-surface px-3 py-2 text-[11px] font-mono">
        <div className="text-white/90 font-semibold mb-1">
          Risk: {(d.risk * 100).toFixed(1)}%
        </div>
        <div className="text-spectra-slate">
          Spectral: {(d.spectral * 100).toFixed(0)}% · Prosody:{' '}
          {(d.prosody * 100).toFixed(0)}%
        </div>
      </div>
    );
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono font-medium tracking-[0.15em] text-spectra-slate uppercase">
          Threat Probability — Rolling 30s
        </h3>
        <div className="flex items-center gap-2 text-[10px] font-mono text-spectra-slate">
          <span className="flex items-center gap-1">
            <span className="block w-2 h-0.5 bg-spectra-crimson rounded" />
            THRESHOLD 60%
          </span>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(27, 36, 54, 0.6)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
              axisLine={{ stroke: '#1b2436' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
              axisLine={{ stroke: '#1b2436' }}
              tickLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={0.6}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={false}
            />
            <Line
              type="monotone"
              dataKey="risk"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, stroke: '#10b981', strokeWidth: 2, fill: '#06080e' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
