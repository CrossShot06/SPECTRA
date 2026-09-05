import { useNavigate } from 'react-router-dom';
import { Phone, LayoutDashboard, Shield, Radio } from 'lucide-react';

/**
 * Hub — Persona selector: Client VoIP Dialer vs SOC Ops Dashboard.
 */
export default function Hub() {
  const navigate = useNavigate();

  const personas = [
    {
      id: 'dialer',
      title: 'Client VoIP Dialer',
      description: 'Simulate an in-app voice call with real-time speech integrity monitoring and risk overlay.',
      icon: Phone,
      route: '/dialer',
      accent: '#10b981',
      accentBg: 'rgba(16, 185, 129, 0.06)',
      accentBorder: 'rgba(16, 185, 129, 0.15)',
    },
    {
      id: 'dashboard',
      title: 'SOC Fraud Dashboard',
      description: 'Enterprise operations view for frontline fraud analysts. Live telemetry, risk graphs, and enforcement controls.',
      icon: LayoutDashboard,
      route: '/dashboard',
      accent: '#f59e0b',
      accentBg: 'rgba(245, 158, 11, 0.06)',
      accentBorder: 'rgba(245, 158, 11, 0.15)',
    },
  ];

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-44px)] px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <Shield className="w-5 h-5 text-spectra-emerald" />
            <h1 className="text-[13px] font-mono font-semibold tracking-[0.2em] text-spectra-emerald uppercase">
              Spectra
            </h1>
          </div>
          <h2 className="text-xl font-semibold text-white/90 mb-2">
            Voice Integrity Framework
          </h2>
          <p className="text-[13px] text-spectra-slate max-w-md mx-auto leading-relaxed">
            Real-time AI detection of synthetic and cloned speech in live VoIP streams.
            Select an interface to begin.
          </p>
        </div>

        {/* Persona cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(p.route)}
              className="group card-surface p-5 text-left transition-all duration-200 hover:scale-[1.01] cursor-pointer"
              style={{
                borderColor: p.accentBorder,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = p.accent + '40';
                e.currentTarget.style.background = p.accentBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = p.accentBorder;
                e.currentTarget.style.background = '#101623';
              }}
            >
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center mb-3.5"
                style={{ background: p.accentBg, border: `1px solid ${p.accentBorder}` }}
              >
                <p.icon className="w-4.5 h-4.5" style={{ color: p.accent }} />
              </div>
              <h3 className="text-[14px] font-semibold text-white/90 mb-1.5">
                {p.title}
              </h3>
              <p className="text-[12px] text-spectra-slate leading-relaxed">
                {p.description}
              </p>
              <div className="flex items-center gap-1 mt-3.5 text-[10px] font-mono tracking-wider" style={{ color: p.accent }}>
                <Radio className="w-3 h-3" />
                LAUNCH INTERFACE
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-[10px] font-mono text-spectra-slate/40 tracking-wider">
          SPECTRA v1.0 — VOICE INTEGRITY VERIFICATION FRAMEWORK
        </div>
      </div>
    </div>
  );
}
