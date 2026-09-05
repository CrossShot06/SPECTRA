from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
import uuid
import time
import numpy as np
import torch
from typing import List
from app.core.audio_buffer import AudioBufferManager, TARGET_BYTES
from app.core.model_service import VoiceIntegrityEngine

router = APIRouter()
buffer_manager = AudioBufferManager()
RISK_THRESHOLD = 0.60
VAD_THRESHOLD = 0.50

torch.set_num_threads(1)
vad_model, utils = torch.hub.load(
    repo_or_dir='snakers4/silero-vad',
    model='silero_vad',
    force_reload=False
)

telemetry_clients: List[WebSocket] = []

@router.websocket("/ws/telemetry")
async def telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    telemetry_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        telemetry_clients.remove(websocket)

@router.websocket("/ws/audio-stream")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    engine = VoiceIntegrityEngine.get_instance()

    # --- Handshake: client must send its real capture rate first ---
    source_sample_rate = 16000
    source_tag = "browser_mic"  # default; overridden if client sends source field
    try:
        init_msg = await websocket.receive_json()
        source_sample_rate = int(init_msg.get("sample_rate", 16000))
        source_tag = init_msg.get("source", "browser_mic")
        print(f"Session {session_id} declared source rate: {source_sample_rate}Hz | source: {source_tag}")
    except Exception:
        print(f"Session {session_id}: no valid handshake, defaulting to 16000Hz")

    try:
        while True:
            audio_chunk = await websocket.receive_bytes()
            total_bytes = await buffer_manager.add_chunk(session_id, audio_chunk)

            if total_bytes >= TARGET_BYTES:
                window_bytes = await buffer_manager.get_window(session_id)
                await buffer_manager.trim(session_id)
                try:
                    start_time = time.time()

                    # Normalize + resample ONCE, reuse for both VAD and AASIST-L
                    raw_array = np.frombuffer(window_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                    resampled = engine.resample_to_target(raw_array, source_sample_rate)

                    print(f"[DEBUG] source_sr={source_sample_rate}, resampled_len={len(resampled)}, "
                          f"min={resampled.min():.4f}, max={resampled.max():.4f}, "
                          f"mean_abs={np.abs(resampled).mean():.4f}")
                          
                    # Ensure at least 8192 samples (16 x 512 VAD frames) after resampling
                    if len(resampled) < 8192:
                        resampled = np.pad(resampled, (0, 8192 - len(resampled)))
                    vad_tensor = torch.from_numpy(resampled[-8192:].copy()).view(16, 512)

                    speech_probs = vad_model(vad_tensor, 16000)
                    speech_prob = float(speech_probs.max().item())

                    if speech_prob < VAD_THRESHOLD:
                        score = 0.0
                        status = "IDLE"
                        latency_ms = int((time.time() - start_time) * 1000)
                    else:
                        raw_score = await run_in_threadpool(engine.score_array, resampled)
                        score = float(raw_score)
                        latency_ms = int((time.time() - start_time) * 1000)
                        status = "CRITICAL_ALERT" if score > RISK_THRESHOLD else "SAFE"

                    payload = {
                        "session_id": session_id,
                        "source": source_tag,
                        "risk_score": round(score, 4),
                        "status": status,
                        "breakdown": {
                            "spectral": round(score, 4),
                            "prosody": 0.05,
                            "identity": 0.02
                        },
                        "latency_ms": latency_ms,
                        "speech_probability": round(speech_prob, 2)
                    }

                    await websocket.send_json(payload)

                    for client in telemetry_clients:
                        try:
                            await client.send_json(payload)
                        except Exception:
                            pass

                except Exception as e:
                    print(f"Inference error: {e}")
                    await websocket.send_json({"status": "error", "detail": "audio_decode_failed"})
            else:
                await websocket.send_json({"status": "buffering", "bytes": total_bytes, "target": TARGET_BYTES})

    except WebSocketDisconnect:
        await buffer_manager.clear(session_id)
        print(f"Session {session_id} disconnected, buffer cleared.")