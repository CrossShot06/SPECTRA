import sys
import asyncio
import websockets
import wave

async def stream_audio(file_path):
    try:
        wf = wave.open(file_path, 'rb')
    except Exception as e:
        print(f"Error opening file: {e}")
        return

    # 16kHz * 1 channel * 2 bytes (16-bit) = 32,000 bytes per second
    # A 500ms chunk is exactly 16,000 bytes (8,000 frames)
    bytes_per_chunk = 16000
    frames_per_chunk = 8000

    print(f"Loaded {file_path}")
    print(f"Format: {wf.getframerate()}Hz, {wf.getnchannels()} channel(s), {wf.getsampwidth()*8}-bit")

    async with websockets.connect("ws://127.0.0.1:8000/ws/audio-stream") as ws:
        while True:
            # Read 500ms of raw PCM audio
            frames = wf.readframes(frames_per_chunk)
            if not frames:
                print("End of audio file reached.")
                break
            
            # Send the raw bytes over the WebSocket
            await ws.send(frames)
            
            # Get the server's response
            response = await ws.recv()
            print(response)
            
            # Sleep 500ms to simulate a real-time live audio stream
            await asyncio.sleep(0.5)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tests/test_ws_pcm_client.py <path_to_wav>")
        sys.exit(1)
    
    asyncio.run(stream_audio(sys.argv[1]))