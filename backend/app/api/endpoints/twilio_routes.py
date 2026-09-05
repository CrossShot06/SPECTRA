"""
app/api/endpoints/twilio_routes.py
------------------------------------
Twilio PSTN inbound call ingestion for Spectra.

Routes
------
POST /voice/incoming
    Twilio calls this when someone dials your Twilio number.
    Returns TwiML that instructs Twilio to open a Media Stream back to
    this server at wss://<TWILIO_NGROK_URL>/ws/twilio-stream.

WS /ws/twilio-stream
    Receives Twilio Media Streams JSON messages (connected / start / media / stop).
    Decodes µ-law audio, resamples to 16 kHz PCM16, feeds AudioBufferManager,
    and broadcasts telemetry payloads with source="twilio_pstn" via the same
    telemetry_clients list used by ws_routes.py.

Environment variables
---------------------
TWILIO_NGROK_URL
    The public HTTPS hostname from ngrok, WITHOUT scheme or trailing slash.
    Example: "abc123.ngrok-free.app"
    Used to build the wss:// URL in TwiML. Must be updated each ngrok restart.

TWILIO_ACCOUNT_SID   (stored for future use / SDK auth — not used for inbound)
TWILIO_AUTH_TOKEN    (stored for future use / SDK auth — not used for inbound)
"""

import os
import json
import time
import numpy as np
import torch

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

# --- Shared state from ws_routes (avoid duplicating global model loads) ---
from app.api.endpoints.websockets.ws_routes import (
    buffer_manager,
    telemetry_clients,
    vad_model,
    VAD_THRESHOLD,
    RISK_THRESHOLD,
)
from app.core.audio_buffer import TARGET_BYTES
from app.core.model_service import VoiceIntegrityEngine
from app.core.mulaw_converter import mulaw_to_pcm16_16k, debug_waveform_stats

router = APIRouter()

# How many consecutive media chunks to log waveform stats for (then silence).
# Set to 0 to disable debug prints entirely after the initial burst.
_DEBUG_CHUNK_LOG_LIMIT = 10


# ---------------------------------------------------------------------------
# POST /voice/incoming  — TwiML webhook
# ---------------------------------------------------------------------------

@router.post("/voice/incoming")
async def voice_incoming(request: Request) -> Response:
    """
    Twilio calls this endpoint when an inbound call arrives on your number.
    Responds with TwiML telling Twilio to stream audio to /ws/twilio-stream.

    Configure this as the "A call comes in" webhook in Twilio Console:
        https://<TWILIO_NGROK_URL>/voice/incoming   (HTTP POST)
    """
    ngrok_url = os.environ.get("TWILIO_NGROK_URL", "").strip().rstrip("/")
    if not ngrok_url:
        # Fail loudly so misconfiguration is obvious in Twilio debugger logs
        return Response(
            content="<Response><Say>Server misconfiguration: TWILIO_NGROK_URL not set.</Say></Response>",
            media_type="application/xml",
            status_code=500,
        )

    stream_ws_url = f"wss://{ngrok_url}/ws/twilio-stream"

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        "<Connect>"
        f'<Stream url="{stream_ws_url}"/>'
        "</Connect>"
        "</Response>"
    )

    print(f"[twilio] Inbound call received → streaming to {stream_ws_url}")
    return Response(content=twiml, media_type="application/xml")


# ---------------------------------------------------------------------------
# WS /ws/twilio-stream  — Twilio Media Streams endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/twilio-stream")
async def twilio_stream(websocket: WebSocket):
    """
    Handles the Twilio Media Streams WebSocket protocol.

    Message format (all are JSON text frames):
        { "event": "connected", ... }
        { "event": "start",  "streamSid": "...", "start": { "callSid": "..." } }
        { "event": "media",  "streamSid": "...", "media": { "payload": "<b64>" } }
        { "event": "stop",   "streamSid": "...", ... }

    Audio spec from Twilio: 8 kHz, 8-bit µ-law (PCMU/G.711), mono.
    After conversion this endpoint feeds 16 kHz PCM16 bytes into AudioBufferManager.
    """
    await websocket.accept()
    engine = VoiceIntegrityEngine.get_instance()

    stream_sid: str = "twilio-unknown"
    debug_chunk_count: int = 0
    source_tag = "twilio_pstn"

    print("[twilio] WebSocket connection accepted")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"[twilio] Non-JSON frame received, skipping: {raw[:80]}")
                continue

            event = msg.get("event", "")

            # ------------------------------------------------------------------
            # "connected" — Twilio handshake acknowledgement
            # ------------------------------------------------------------------
            if event == "connected":
                print(f"[twilio] Media stream connected: {msg}")

            # ------------------------------------------------------------------
            # "start" — stream metadata (callSid, streamSid, accountSid, etc.)
            # ------------------------------------------------------------------
            elif event == "start":
                stream_sid = msg.get("streamSid", stream_sid)
                call_sid = msg.get("start", {}).get("callSid", "unknown")
                print(
                    f"[twilio] Stream started | streamSid={stream_sid} | callSid={call_sid}"
                )

            # ------------------------------------------------------------------
            # "media" — actual audio payload
            # ------------------------------------------------------------------
            elif event == "media":
                media_obj = msg.get("media", {})
                payload_b64: str = media_obj.get("payload", "")

                if not payload_b64:
                    continue

                # Decode µ-law → 16 kHz PCM16 bytes
                pcm16_bytes = mulaw_to_pcm16_16k(payload_b64)

                if not pcm16_bytes:
                    continue

                # Optional waveform sanity logging for first N chunks
                if debug_chunk_count < _DEBUG_CHUNK_LOG_LIMIT:
                    debug_waveform_stats(pcm16_bytes)
                    debug_chunk_count += 1

                # Feed into shared buffer (use streamSid as session key)
                total_bytes = await buffer_manager.add_chunk(stream_sid, pcm16_bytes)

                if total_bytes >= TARGET_BYTES:
                    window_bytes = await buffer_manager.get_window(stream_sid)
                    print(
                        f"[twilio] window trigger: {len(window_bytes)} bytes "
                        f"({len(window_bytes) // 2} samples, target was {TARGET_BYTES})"
                    )
                    await buffer_manager.trim(stream_sid)

                    try:
                        start_time = time.time()

                        # Audio is already 16kHz PCM16 — normalize only, no resample
                        raw_array = (
                            np.frombuffer(window_bytes, dtype=np.int16)
                            .astype(np.float32)
                            / 32768.0
                        )

                        # Pad to VAD minimum (8192 samples = 16 × 512 frames)
                        if len(raw_array) < 8192:
                            raw_array = np.pad(raw_array, (0, 8192 - len(raw_array)))

                        vad_tensor = (
                            torch.from_numpy(raw_array[-8192:].copy()).view(16, 512)
                        )
                        speech_probs = vad_model(vad_tensor, 16000)
                        speech_prob = float(speech_probs.max().item())

                        if speech_prob < VAD_THRESHOLD:
                            score = 0.0
                            status = "IDLE"
                            latency_ms = int((time.time() - start_time) * 1000)
                        else:
                            raw_score = await run_in_threadpool(
                                engine.score_array, raw_array
                            )
                            score = float(raw_score)
                            latency_ms = int((time.time() - start_time) * 1000)
                            status = (
                                "CRITICAL_ALERT" if score > RISK_THRESHOLD else "SAFE"
                            )

                        payload = {
                            "session_id": stream_sid,
                            "source": source_tag,
                            "risk_score": round(score, 4),
                            "status": status,
                            "breakdown": {
                                "spectral": round(score, 4),
                                "prosody": 0.05,
                                "identity": 0.02,
                            },
                            "latency_ms": latency_ms,
                            "speech_probability": round(speech_prob, 2),
                        }

                        for client in telemetry_clients:
                            try:
                                await client.send_json(payload)
                            except Exception:
                                pass

                    except Exception as e:
                        print(f"[twilio] Inference error for {stream_sid}: {e}")

            # ------------------------------------------------------------------
            # "stop" — call ended, clean up buffer
            # ------------------------------------------------------------------
            elif event == "stop":
                print(f"[twilio] Stream stopped | streamSid={stream_sid}")
                await buffer_manager.clear(stream_sid)
                break

            else:
                # Unknown event — log and continue (forward-compatible)
                print(f"[twilio] Unknown event '{event}': {raw[:120]}")

    except WebSocketDisconnect:
        print(f"[twilio] WebSocket disconnected | streamSid={stream_sid}")
        await buffer_manager.clear(stream_sid)
    except Exception as e:
        print(f"[twilio] Unexpected error | streamSid={stream_sid} | {e}")
        await buffer_manager.clear(stream_sid)
