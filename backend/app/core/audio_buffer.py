import redis.asyncio as redis

class AudioBufferManager:
    def __init__(self, redis_url="redis://localhost:6379", window_chunks=8):
        self.client = redis.from_url(redis_url)
        self.window_chunks = window_chunks  # 8 x 500ms = 4s window

    def _key(self, session_id: str) -> str:
        return f"audio_buffer:{session_id}"

    async def add_chunk(self, session_id: str, chunk: bytes) -> int:
        key = self._key(session_id)
        await self.client.rpush(key, chunk)
        await self.client.expire(key, 30)  # safety TTL so orphaned keys don't linger
        return await self.client.llen(key)

    async def get_window(self, session_id: str) -> bytes:
        chunks = await self.client.lrange(self._key(session_id), -self.window_chunks, -1)
        return b"".join(chunks)

    async def trim(self, session_id: str, keep_last: int = 4):
        # keep half the window for overlap so you're not scoring on hard cuts
        await self.client.ltrim(self._key(session_id), -keep_last, -1)

    async def clear(self, session_id: str):
        await self.client.delete(self._key(session_id))