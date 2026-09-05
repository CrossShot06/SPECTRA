import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useWebRTCCall — Manages WebRTC peer-to-peer calling and routes the REMOTE 
 * audio stream to the Spectra fraud detection backend pipeline.
 */
export function useWebRTCCall(
  signalingUrl = 'ws://localhost:8000/ws/signaling',
  audioStreamUrl = 'ws://localhost:8000/ws/audio-stream'
) {
  const [callState, setCallState] = useState('IDLE'); // IDLE, CALLING, CONNECTED, ERROR
  const [error, setError] = useState(null);
  
  // Waveform state for the UI
  const waveformRef = useRef(new Float32Array(128));
  const [waveformTick, setWaveformTick] = useState(0);

  // WebRTC & Audio Pipeline Refs
  const signalingWsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  
  // Analysis Pipeline Refs (for remote audio)
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const analysisWsRef = useRef(null);

  const cleanup = useCallback(() => {
    // 1. Cleanup Analysis Pipeline
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (analysisWsRef.current) {
      analysisWsRef.current.close();
      analysisWsRef.current = null;
    }

    // 2. Cleanup WebRTC Pipeline
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (signalingWsRef.current) {
      signalingWsRef.current.close();
      signalingWsRef.current = null;
    }

    setCallState('IDLE');
    setWaveformTick(0);
    waveformRef.current = new Float32Array(128);
  }, []);

  const setupAnalysisPipeline = useCallback(async (remoteStream) => {
    try {
      // 1. Create AudioContext
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      // 2. Load AudioWorklet
      await audioCtx.audioWorklet.addModule('/pcm-processor.js');

      // 3. Source from REMOTE stream
      const source = audioCtx.createMediaStreamSource(remoteStream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;

      source.connect(workletNode);
      // We also connect the remote stream to destination so we can hear them!
      source.connect(audioCtx.destination); 

      // 4. Open WebSocket to existing backend pipeline
      const ws = new WebSocket(audioStreamUrl);
      ws.binaryType = 'arraybuffer';
      analysisWsRef.current = ws;

      ws.onopen = () => {
        // Send handshake as expected by backend
        ws.send(JSON.stringify({ sample_rate: 16000, source: 'webrtc_peer' }));
      };

      ws.onerror = () => {
        console.error("Analysis WS error");
        setError('Analysis WS connection failed');
      };

      // 5. Listen for worklet messages and forward chunks
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
      console.error("Analysis pipeline error:", err);
      setError('Failed to setup analysis pipeline: ' + err.message);
    }
  }, [audioStreamUrl]);

  const startCall = useCallback(async (roomId) => {
    try {
      setError(null);
      setCallState('CALLING');

      // 1. Acquire Local Microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      localStreamRef.current = stream;

      // 2. Connect to Signaling Server
      const signalingWs = new WebSocket(`${signalingUrl}/${roomId}`);
      signalingWsRef.current = signalingWs;

      // 3. Setup RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
      });
      peerConnectionRef.current = pc;

      // Add local track to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle incoming remote track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          setCallState('CONNECTED');
          setupAnalysisPipeline(remoteStream);
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && signalingWs.readyState === WebSocket.OPEN) {
          signalingWs.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };

      // Handle Signaling Messages
      signalingWs.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        try {
          if (message.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signalingWs.send(JSON.stringify({ type: 'answer', answer }));
          } else if (message.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
          } else if (message.type === 'ice-candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          }
        } catch (err) {
          console.error("Error processing signaling message", err);
        }
      };

      // If we are the initiator (e.g. we connect, we should offer after a small delay 
      // or we can just proactively offer. To be safe, we'll offer immediately upon connect).
      signalingWs.onopen = async () => {
        // Simple logic: whoever joins creates an offer. 
        // If the other side is already there, they will answer.
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signalingWs.send(JSON.stringify({ type: 'offer', offer }));
        } catch (err) {
          console.error("Error creating offer", err);
        }
      };

      signalingWs.onerror = () => {
        setError('Signaling server connection failed');
        cleanup();
      };
      
      signalingWs.onclose = () => {
        cleanup();
      };

    } catch (err) {
      setError(err.message || 'Failed to initialize call');
      cleanup();
    }
  }, [signalingUrl, setupAnalysisPipeline, cleanup]);

  const endCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    callState,
    startCall,
    endCall,
    waveformData: waveformRef.current,
    waveformTick,
    error,
  };
}
