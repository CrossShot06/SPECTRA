"""
app/core/audio_buffer.py
-------------------------
Byte-length-based audio buffer manager backed by Redis.

Triggering model inference based on chunk COUNT was broken when multiple
ingestion paths send differently-sized chunks:
  - Browser / WebRTC path: 8,000 bytes/chunk  (500 ms at 16 kHz PCM16)
  - Twilio PSTN path:        640 bytes/chunk  ( 20 ms at 16 kHz PCM16,
                                               after µ-law decode + resample)

This version tracks TOTAL BUFFERED BYTES instead, so the window fires at
the same real audio duration (and sample count) regardless of source.

Target constants (must match VoiceIntegrityEngine.target_length):
    TARGET_SAMPLES  = 64,600   samples  (AASIST-L expected input length)
    TARGET_BYTES    = 129,200  bytes    (64,600 × 2 bytes per int16 sample)
    KEEP_BYTES      = 64,600   bytes    (half-window overlap between inferences)

Concurrency note
----------------
Each WebSocket session is served by exactly ONE asyncio coroutine (the
handler function). All Redis calls within a handler are awaited sequentially,
so there is NO intra-session concurrency. Two sessions never share a Redis
key (keys are namespaced by session_id), so there is NO inter-session
contention either.

The one pattern to be aware of: get_window() followed by trim() are two
separate round-trips to Redis. If another coroutine for the *same session*
could run between them, it might push a chunk that trim() then drops. That
cannot happen here because each session has exactly one owning coroutine.
If this assumption ever changes (e.g. shared sessions), wrap get+trim in a
Lua script or Redis pipeline with MULTI/EXEC.
"""

import redis.asyncio as redis

# ---------------------------------------------------------------------------
# Byte-length targets — must stay in sync with VoiceIntegrityEngine.target_length
# ---------------------------------------------------------------------------
TARGET_SAMPLES: int = 64_600           # AASIST-L expected input length (samples)
TARGET_BYTES:   int = TARGET_SAMPLES * 2   # int16 = 2 bytes per sample → 129,200
KEEP_BYTES:     int = TARGET_BYTES // 2    # 50 % overlap retained after trim → 64,600

_BUFFER_TTL_SECONDS: int = 30          # safety expiry for orphaned keys


class AudioBufferManager:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.client = redis.from_url(redis_url)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _key(self, session_id: str) -> str:
        return f"audio_buffer:{session_id}"

    async def _total_bytes(self, session_id: str) -> int:
        """Sum of byte lengths of all list entries for this session."""
        key = self._key(session_id)
        chunks = await self.client.lrange(key, 0, -1)
        return sum(len(c) for c in chunks)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def add_chunk(self, session_id: str, chunk: bytes) -> int:
        """
        Append a chunk to the buffer. Returns the TOTAL BUFFERED BYTE COUNT
        after appending (replacing the old chunk-count return value).

        Callers should check is_window_ready() after each add_chunk() to
        decide whether to trigger inference — or simply compare the returned
        byte count against TARGET_BYTES themselves.
        """
        key = self._key(session_id)
        await self.client.rpush(key, chunk)
        await self.client.expire(key, _BUFFER_TTL_SECONDS)
        return await self._total_bytes(session_id)

    async def is_window_ready(self, session_id: str) -> bool:
        """
        Returns True when the buffer holds at least TARGET_BYTES of audio.
        A single call to _total_bytes — callers may use the return value of
        add_chunk() directly instead to save a round-trip:

            total = await buffer_manager.add_chunk(sid, chunk)
            if total >= TARGET_BYTES:
                ...
        """
        return await self._total_bytes(session_id) >= TARGET_BYTES

    async def get_window(self, session_id: str) -> bytes:
        """
        Return exactly TARGET_BYTES of the most-recently buffered audio.

        If the concatenated buffer is larger than TARGET_BYTES (which happens
        when the last chunk pushed it over the edge), the returned slice is
        trimmed to TARGET_BYTES from the END so the model always sees the
        most recent audio, never stale older samples.
        """
        chunks = await self.client.lrange(self._key(session_id), 0, -1)
        raw = b"".join(chunks)
        # Take the tail so we score the most recent audio
        return raw[-TARGET_BYTES:] if len(raw) > TARGET_BYTES else raw

    async def trim(self, session_id: str, keep_bytes: int = KEEP_BYTES):
        """
        Retain the most recent `keep_bytes` of audio in the buffer after an
        inference window is processed, providing a 50 % overlap so scoring
        windows don't start on hard cuts.

        Implementation: read all chunks, concatenate, slice the tail, write
        back as a SINGLE list entry. O(n) on a few seconds of audio — cheap.

        Why not Redis LTRIM (the old approach)?
        LTRIM operates by list-entry *count*, which produced the correct
        overlap for fixed-size chunks but is meaningless for variable-size
        ones (e.g. keeping 4 entries of 640 bytes each ≠ keeping 4 entries
        of 8,000 bytes each).
        """
        key = self._key(session_id)
        chunks = await self.client.lrange(key, 0, -1)
        if not chunks:
            return

        raw = b"".join(chunks)
        retained = raw[-keep_bytes:] if len(raw) > keep_bytes else raw

        # Atomically replace the list with a single retained entry.
        # MULTI/EXEC ensures no other client touches the key between DELETE and RPUSH.
        async with self.client.pipeline(transaction=True) as pipe:
            pipe.delete(key)
            pipe.rpush(key, retained)
            pipe.expire(key, _BUFFER_TTL_SECONDS)
            await pipe.execute()

    async def clear(self, session_id: str):
        """Delete the buffer entirely (call on disconnect or call end)."""
        await self.client.delete(self._key(session_id))