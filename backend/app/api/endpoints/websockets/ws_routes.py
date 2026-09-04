from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
import uuid
from app.core.audio_buffer import AudioBufferManager
from app.core.model_service import VoiceIntegrityEngine

router = APIRouter()
buffer_manager = AudioBufferManager()
RISK_THRESHOLD = 0.60
WINDOW_CHUNKS = 8

@router.websocket("/ws/audio-stream")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    engine = VoiceIntegrityEngine.get_instance()

    try:
        while True:
            audio_chunk = await websocket.receive_bytes()
            chunk_count = await buffer_manager.add_chunk(session_id, audio_chunk)

            if chunk_count >= WINDOW_CHUNKS:
                window_bytes = await buffer_manager.get_window(session_id)
                await buffer_manager.trim(session_id, keep_last=4)

                # inference is CPU-blocking — keep it off the event loop
                try:
                    score = await run_in_threadpool(engine.score_pcm_bytes, window_bytes)
                    status = "CRITICAL_ALERT" if score > RISK_THRESHOLD else "SAFE"
                    await websocket.send_json({"risk_score": round(score, 4), "status": status})

                    if status == "CRITICAL_ALERT":
                        pass  # Phase 3: fire escalation to your Modal endpoint here
                except Exception as e:
                    print(f"Inference error: {e}")
                    await websocket.send_json({"status": "error", "detail": "audio_decode_failed"})
            else:
                await websocket.send_json({"status": "buffering", "chunks": chunk_count})

    except WebSocketDisconnect:
        await buffer_manager.clear(session_id)
        print(f"Session {session_id} disconnected, buffer cleared.")