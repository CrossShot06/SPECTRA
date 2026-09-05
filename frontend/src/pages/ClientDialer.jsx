import { useState, useCallback, useEffect, useRef } from 'react';
import { Phone, PhoneOff, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Keypad from '@/components/dialer/Keypad';
import Waveform from '@/components/dialer/Waveform';
import RiskBadge from '@/components/dialer/RiskBadge';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';

/**
 * ClientDialer — Mobile-viewport VoIP dialer with live oscilloscope and risk banner.
 */
export default function ClientDialer({ telemetry }) {
  const navigate = useNavigate();
  const [dialedNumber, setDialedNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);

  const { callState, startCall, endCall, waveformData, waveformTick, error } =
    useWebRTCCall();
  
  const callActive = callState !== 'IDLE';

  const riskScore = telemetry?.risk_score || 0;
  const status = telemetry?.status || 'IDLE';

  // Call duration timer
  useEffect(() => {
    if (callActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else {
      clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [callActive]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleDigit = useCallback(
    (key) => {
      if (!callActive) {
        setDialedNumber((prev) => prev + key);
      }
    },
    [callActive]
  );

  const handleCall = useCallback(async () => {
    if (callActive) {
      endCall();
    } else {
      if (!dialedNumber) return;
      await startCall(dialedNumber);
    }
  }, [callActive, startCall, endCall, dialedNumber]);

  const handleBackspace = useCallback(() => {
    setDialedNumber((prev) => prev.slice(0, -1));
  }, []);

  // Risk banner text
  const getBannerText = () => {
    if (!callActive) return 'SECURE CHANNEL // IDLE';
    if (riskScore >= 0.6)
      return `CRITICAL: SYNTHETIC VOICE DETECTED [RISK: ${(riskScore * 100).toFixed(1)}%]`;
    if (riskScore >= 0.3)
      return `ANOMALY DETECTED — MONITORING [RISK: ${(riskScore * 100).toFixed(1)}%]`;
    return `VERIFIED AUTHENTIC SPEECH [RISK: ${(riskScore * 100).toFixed(1)}%]`;
  };

  const getBannerColor = () => {
    if (!callActive) return 'text-spectra-slate';
    if (riskScore >= 0.6) return 'text-spectra-crimson animate-risk-flash';
    if (riskScore >= 0.3) return 'text-spectra-amber';
    return 'text-spectra-emerald';
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-44px)] py-6 px-4">
      {/* Phone chassis */}
      <div className="w-full max-w-[390px] bg-spectra-surface border border-spectra-border rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-spectra-border">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-[11px] font-mono text-spectra-slate hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            HUB
          </button>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-spectra-slate">
            <Lock className="w-3 h-3" />
            E2E ENCRYPTED
          </div>
        </div>

        {/* Risk banner */}
        <div
          className={`px-4 py-2 border-b border-spectra-border ${
            callActive && riskScore >= 0.6
              ? 'bg-spectra-crimson/5'
              : 'bg-spectra-card/50'
          }`}
        >
          <div className={`text-[10px] font-mono font-semibold tracking-wider text-center ${getBannerColor()}`}>
            {getBannerText()}
          </div>
        </div>

        {/* Call info */}
        <div className="text-center py-4 px-4">
          {callActive ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-mono text-spectra-slate tracking-wider">
                ACTIVE CALL
              </span>
              <span className="text-2xl font-mono font-semibold font-tabular text-white/90">
                {formatDuration(callDuration)}
              </span>
              <RiskBadge riskScore={riskScore} status={status} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-mono text-spectra-slate tracking-wider">
                {dialedNumber ? 'DIALING' : 'ENTER NUMBER'}
              </span>
              <span className="text-2xl font-mono font-semibold font-tabular text-white/90 min-h-[36px] tracking-wider">
                {dialedNumber || '\u00A0'}
              </span>
              {dialedNumber && (
                <button
                  onClick={handleBackspace}
                  className="text-[10px] font-mono text-spectra-slate hover:text-white transition-colors mt-0.5 cursor-pointer"
                >
                  ← DELETE
                </button>
              )}
            </div>
          )}
        </div>

        {/* Waveform */}
        <div className="mx-4 mb-4 h-[80px] rounded-md border border-spectra-border overflow-hidden">
          <Waveform
            samples={waveformData}
            isActive={callState === 'CONNECTED'}
            riskScore={riskScore}
          />
        </div>

        {/* Keypad */}
        <div className="mb-4">
          <Keypad onDigit={handleDigit} />
        </div>

        {/* Call button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleCall}
            className={`w-full h-[48px] rounded-lg flex items-center justify-center gap-2 font-semibold text-[13px] transition-all duration-150 cursor-pointer ${
              callActive
                ? 'bg-spectra-crimson/15 border border-spectra-crimson/30 text-spectra-crimson hover:bg-spectra-crimson/25'
                : 'bg-spectra-emerald/15 border border-spectra-emerald/30 text-spectra-emerald hover:bg-spectra-emerald/25'
            }`}
          >
            {callActive ? (
              <>
                <PhoneOff className="w-4 h-4" />
                END CALL
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                START CALL
              </>
            )}
          </button>

          {error && (
            <div className="mt-2 text-[10px] font-mono text-spectra-crimson text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
