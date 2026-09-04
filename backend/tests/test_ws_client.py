# test_ws_client.py — run separately to sanity check the endpoint
import asyncio
import websockets

async def test():
    async with websockets.connect("ws://127.0.0.1:8000/ws/audio-stream") as ws:
        # send a few dummy chunks to confirm buffering messages come back
        for i in range(9):
            await ws.send(b"\x00" * 1000)
            response = await ws.recv()
            print(response)
asyncio.run(test())