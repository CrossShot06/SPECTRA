import { Activity, Wifi, WifiOff, Clock } from 'lucide-react';

/**
 * Shell — Top-level dark header bar with live socket status and latency telemetry.
 */
export default function Shell({ children, isConnected, latencyMs }) {
  return (
    <div className="min-h-screen flex flex-col bg-spectra-bg">
      {/* ─── HEADER ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-spectra-border bg-spectra-surface/80 backdrop-blur-sm flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-spectra-emerald" />
          <span className="text-[13px] font-semibold tracking-widest text-white/90 uppercase">
            Spectra
          </span>
          <span className="text-[10px] font-mono text-spectra-slate tracking-wide">
            v1.0
          </span>
        </div>

        {/* Telemetry cluster */}
        <div className="flex items-center gap-4">
          {/* Socket status */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-spectra-emerald" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-spectra-crimson" />
            )}
            <span
              className={`text-[11px] font-mono font-medium tracking-wide ${
                isConnected ? 'text-spectra-emerald' : 'text-spectra-crimson'
              }`}
            >
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Latency */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-spectra-slate" />
            <span className="text-[11px] font-mono font-tabular text-spectra-slate">
              {latencyMs}ms
            </span>
          </div>

          {/* Live dot */}
          <div className="flex items-center gap-1.5">
            <span
              className={`block w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? 'bg-spectra-emerald live-dot'
                  : 'bg-spectra-crimson'
              }`}
            />
          </div>
        </div>
      </header>

      {/* ─── CONTENT ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">{children}</main>

      {/* ─── SCANLINE OVERLAY ────────────────────────────────────── */}
      <div className="scanline-overlay" />
    </div>
  );
}
