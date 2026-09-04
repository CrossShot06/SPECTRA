# tests/test_ws_pcm_client.py
# Streams a real WAV file to the /ws/audio-stream endpoint as raw 16-bit PCM
# chunks (headerless), matching exactly what score_pcm_bytes expects.

import asyncio
import sys
import numpy as np
import soundfile as sf
import websockets

CHUNK_MS = 500          # matches your 500ms chunking assumption
SAMPLE_RATE = 16000      # matches AASIST-L's expected input rate
WS_URL = "ws://127.0.0.1:8000/ws/audio-stream"


def load_as_pcm16(file_path: str) -> bytes:
    """Load any wav file, force mono + 16kHz + int16, return raw PCM bytes."""
    data, sr = sf.read(file_path, dtype="float32")

    if data.ndim > 1:
        data = data.mean(axis=1)  # downmix to mono

    if sr != SAMPLE_RATE:
        # simple resample via numpy (adequate for test purposes)
        import torch
        import torchaudio
        waveform = torch.from_numpy(data).unsqueeze(0)
        waveform = torchaudio.transforms.Resample(sr, SAMPLE_RATE)(waveform)
        data = waveform.squeeze(0).numpy()

    # float32 [-1, 1] -> int16 PCM
    pcm16 = (data * 32767).astype(np.int16)
    return pcm16.tobytes()


async def stream_file(file_path: str):
    pcm_bytes = load_as_pcm16(file_path)

    bytes_per_sample = 2  # int16
    chunk_samples = int(SAMPLE_RATE * (CHUNK_MS / 1000))
    chunk_size = chunk_samples * bytes_per_sample

    print(f"Loaded {file_path}: {len(pcm_bytes)} bytes, "
          f"{len(pcm_bytes) // chunk_size} chunks of {chunk_size} bytes each")

    async with websockets.connect(WS_URL) as ws:
        for i in range(0, len(pcm_bytes), chunk_size):
            chunk = pcm_bytes[i:i + chunk_size]
            if len(chunk) < chunk_size:
                # pad the final partial chunk with silence so it doesn't break framing
                chunk = chunk + b"\x00" * (chunk_size - len(chunk))

            await ws.send(chunk)
            response = await ws.recv()
            print(response)

            await asyncio.sleep(CHUNK_MS / 1000)  # simulate real-time pacing


if __name__ == "__main__":
    target_file = sys.argv[1] if len(sys.argv) > 1 else "genuine.wav"
    asyncio.run(stream_file(target_file))