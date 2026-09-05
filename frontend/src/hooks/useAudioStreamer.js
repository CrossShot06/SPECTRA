import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useAudioStreamer — Manages the full mic → AudioWorklet → WebSocket pipeline.
 *
 * Returns:
 *   { isStreaming, start, stop, waveformData, error }
 *
 * - start(): Acquires mic, boots AudioWorklet, opens WS to backend.
 * - stop():  Tears down everything cleanly.
 * - waveformData: latest Float32Array of raw samples for oscilloscope rendering.
 */
export function useAudioStreamer(wsUrl = 'ws://localhost:8000/ws/audio-stream') {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const waveformRef = useRef(new Float32Array(128));
  const [waveformTick, setWaveformTick] = useState(0);

  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const animFrameRef = useRef(null);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => { });
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsStreaming(false);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);

      // 1. Acquire microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // 2. Create AudioContext
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      // 3. Load AudioWorklet
      await audioCtx.audioWorklet.addModule('/pcm-processor.js');

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;

      source.connect(workletNode);
      // Don't connect to destination — we don't want feedback

      // 4. Open WebSocket
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ sample_rate: 16000, source: 'browser_mic' }));
        setIsStreaming(true);
      };

      ws.onerror = () => {
        setError('WebSocket connection failed');
        cleanup();
      };

      ws.onclose = () => {
        setIsStreaming(false);
      };

      // 5. Listen for worklet messages
      workletNode.port.onmessage = (event) => {
        const { type, buffer, samples } = event.data;

        if (type === 'pcm-chunk' && ws.readyState === WebSocket.OPEN) {
          ws.send(buffer);
        }

        if (type === 'waveform') {
          waveformRef.current = samples;
          setWaveformTick((t) => t + 1);
        }
      };
    } catch (err) {
      setError(err.message || 'Failed to acquire microphone');
      cleanup();
    }
  }, [wsUrl, cleanup]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    isStreaming,
    start,
    stop,
    waveformData: waveformRef.current,
    waveformTick,
    error,
  };
}
