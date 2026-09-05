import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useSpectraSocket — Subscribes to backend telemetry events via WebSocket.
 *
 * Incoming JSON contract:
 * {
 *   session_id: string,
 *   risk_score: number,        // 0.0 – 1.0
 *   status: string,            // "IDLE" | "MONITORING" | "CRITICAL_ALERT"
 *   breakdown: { spectral: number, prosody: number, identity: number },
 *   latency_ms: number
 * }
 *
 * Returns:
 *   { telemetry, riskHistory, isConnected, latencyMs, reconnect }
 */
const MAX_HISTORY = 60; // ~30s at 2 updates/sec

export function useSpectraSocket(wsUrl = 'ws://localhost:8000/ws/telemetry') {
  const [telemetry, setTelemetry] = useState({
    session_id: '—',
    risk_score: 0,
    status: 'IDLE',
    breakdown: { spectral: 0, prosody: 0, identity: 0 },
    latency_ms: 0,
  });

  const [riskHistory, setRiskHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setIsConnected(true);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        setTelemetry(data);
        setLatencyMs(data.latency_ms || 0);

        setRiskHistory((prev) => {
          const next = [
            ...prev,
            {
              time: Date.now(),
              risk: data.risk_score,
              spectral: data.breakdown?.spectral || 0,
              prosody: data.breakdown?.prosody || 0,
              identity: data.breakdown?.identity || 0,
            },
          ];
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
      } catch {
        // silently drop malformed frames
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      // Auto-reconnect after 2s
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [wsUrl]);

  const reconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    clearTimeout(reconnectTimerRef.current);
    connect();
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { telemetry, riskHistory, isConnected, latencyMs, reconnect };
}
