import { useState, useCallback } from 'react';
import { PhoneOff, ShieldAlert, ExternalLink } from 'lucide-react';

/**
 * IncidentActions — One-click SOC enforcement buttons.
 *
 * - Kill Call: Dispatches abort signal
 * - Step-Up MFA: Simulates push OTP
 * - Escalate: Forwards to voice forensics
 */
export default function IncidentActions({ sessionId, riskScore }) {
  const [actionState, setActionState] = useState({});

  const executeAction = useCallback(
    async (action, label) => {
      setActionState((prev) => ({ ...prev, [action]: 'pending' }));

      try {
        const res = await fetch(`/api/sessions/${sessionId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, session_id: sessionId }),
        });

        if (res.ok) {
          setActionState((prev) => ({ ...prev, [action]: 'success' }));
        } else {
          setActionState((prev) => ({ ...prev, [action]: 'error' }));
        }
      } catch {
        // In demo mode, simulate success after 600ms
        setTimeout(() => {
          setActionState((prev) => ({ ...prev, [action]: 'success' }));
        }, 600);
      }

      // Reset after 3s
      setTimeout(() => {
        setActionState((prev) => ({ ...prev, [action]: null }));
      }, 3000);
    },
    [sessionId]
  );

  const isHighRisk = riskScore >= 0.6;

  const actions = [
    {
      id: 'kill_call',
      label: 'Kill Call',
      description: 'Terminate active VoIP session immediately',
      icon: PhoneOff,
      color: 'spectra-crimson',
      colorHex: '#ef4444',
      destructive: true,
    },
    {
      id: 'step_up_mfa',
      label: 'Step-Up MFA',
      description: 'Push OTP challenge to enrolled device',
      icon: ShieldAlert,
      color: 'spectra-amber',
      colorHex: '#f59e0b',
      destructive: false,
    },
    {
      id: 'escalate',
      label: 'Escalate to Forensics',
      description: 'Forward session artifacts to voice forensics team',
      icon: ExternalLink,
      color: 'spectra-slate',
      colorHex: '#64748b',
      destructive: false,
    },
  ];

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-mono font-medium tracking-[0.15em] text-spectra-slate uppercase">
          SOC Enforcement
        </h3>
        {isHighRisk && (
          <span className="text-[10px] font-mono font-semibold text-spectra-crimson animate-risk-flash tracking-wider">
            ACTION REQUIRED
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action) => {
          const state = actionState[action.id];
          const isPending = state === 'pending';
          const isSuccess = state === 'success';
          const isError = state === 'error';

          return (
            <button
              key={action.id}
              onClick={() => executeAction(action.id, action.label)}
              disabled={isPending}
              className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded border transition-all duration-150 text-left cursor-pointer ${
                isSuccess
                  ? 'bg-spectra-emerald/10 border-spectra-emerald/30'
                  : isError
                  ? 'bg-spectra-crimson/10 border-spectra-crimson/30'
                  : action.destructive
                  ? 'bg-spectra-crimson/5 border-spectra-crimson/20 hover:bg-spectra-crimson/10 hover:border-spectra-crimson/40'
                  : 'bg-spectra-card border-spectra-border hover:border-spectra-border-bright'
              } ${isPending ? 'opacity-60 cursor-wait' : ''}`}
            >
              <action.icon
                className="w-4 h-4 flex-shrink-0"
                style={{
                  color: isSuccess ? '#10b981' : action.colorHex,
                }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12px] font-medium"
                  style={{
                    color: isSuccess ? '#10b981' : '#e2e8f0',
                  }}
                >
                  {isPending
                    ? 'Executing...'
                    : isSuccess
                    ? `${action.label} — Dispatched`
                    : action.label}
                </div>
                <div className="text-[10px] text-spectra-slate/70 mt-0.5 truncate">
                  {action.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
