"""
app/core/mulaw_converter.py
----------------------------
Converts Twilio Media Streams audio to the 16kHz PCM16 format expected by
AudioBufferManager and VoiceIntegrityEngine.

Twilio sends audio as: 8 kHz, 8-bit µ-law (G.711 PCMU), mono.
Pipeline:
    base64 payload  →  raw µ-law bytes
                    →  int16 linear PCM at 8 kHz   (lookup-table decode)
                    →  int16 linear PCM at 16 kHz  (resample_poly ×2)
                    →  bytes ready for AudioBufferManager.add_chunk()

Why a lookup table instead of audioop / audioop-lts?
  Python 3.13+ removed the `audioop` stdlib module. Using a 256-entry lookup
  table (the values come directly from the ITU-T G.711 spec / RFC 3551) is the
  most portable approach and adds no new pip dependency.

Public API:
    mulaw_to_pcm16_16k(payload_b64: str) -> bytes
    debug_waveform_stats(pcm16_bytes: bytes) -> None
"""

import base64
import numpy as np
from scipy.signal import resample_poly

# ---------------------------------------------------------------------------
# G.711 µ-law → 16-bit linear PCM lookup table
# Generated from the ITU-T G.711 specification formula:
#   linear = sign * (exp(µ-law) - 1) * BIAS
# where BIAS = 33, MU = 255.
# The table is pre-computed at import time (256 entries, negligible overhead).
# ---------------------------------------------------------------------------

def _build_mulaw_table() -> np.ndarray:
    """Return a (256,) int16 array mapping µ-law byte → linear PCM16 sample."""
    table = np.zeros(256, dtype=np.int16)
    for i in range(256):
        # Invert all bits (µ-law is bit-inverted on the wire)
        ulaw = ~i & 0xFF

        sign = -1 if (ulaw & 0x80) else 1
        exponent = (ulaw >> 4) & 0x07
        mantissa = ulaw & 0x0F

        # Decode: linear = sign * ((mantissa << 1 | 1) << (exponent + 2)) - 33
        magnitude = ((mantissa << 1) | 1) << (exponent + 2)
        linear = sign * (magnitude - 33)

        # Clamp to int16 range
        linear = max(-32768, min(32767, linear))
        table[i] = linear
    return table


_MULAW_TABLE: np.ndarray = _build_mulaw_table()

# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def mulaw_to_pcm16_16k(payload_b64: str) -> bytes:
    """
    Decode a Twilio base64-encoded µ-law chunk and return 16kHz PCM16 bytes.

    Args:
        payload_b64: The value of msg["media"]["payload"] from a Twilio
                     Media Streams "media" event.

    Returns:
        Raw bytes of int16 samples at 16kHz (little-endian), suitable for
        passing directly to AudioBufferManager.add_chunk().
    """
    # 1. Base64 → raw µ-law bytes
    raw_mulaw: bytes = base64.b64decode(payload_b64)
    if not raw_mulaw:
        return b""

    # 2. µ-law bytes → int16 linear PCM at 8 kHz
    #    Each byte indexes into the 256-entry lookup table.
    mulaw_indices = np.frombuffer(raw_mulaw, dtype=np.uint8)
    pcm_8k: np.ndarray = _MULAW_TABLE[mulaw_indices]  # shape: (N,), dtype int16

    # 3. Resample 8 kHz → 16 kHz (upsample by 2, downsample by 1)
    #    Convert to float32 first (resample_poly works best with floats),
    #    then convert back to int16 without clipping (signal is already in range).
    pcm_8k_f32 = pcm_8k.astype(np.float32)
    pcm_16k_f32: np.ndarray = resample_poly(pcm_8k_f32, up=2, down=1)

    # Round and clamp back to int16
    pcm_16k = np.clip(np.round(pcm_16k_f32), -32768, 32767).astype(np.int16)

    # 4. Return as raw bytes (little-endian int16, matching PCM16 convention)
    return pcm_16k.tobytes()


def debug_waveform_stats(pcm16_bytes: bytes) -> None:
    """
    Print min/max/mean_abs of a PCM16 byte buffer to stderr/stdout.
    Call this after mulaw_to_pcm16_16k() to verify the conversion is producing
    sane audio before trusting any risk scores from the Twilio path.

    Example output (real speech should show mean_abs >> 0):
        [mulaw debug] samples=320 min=-4112 max=4080 mean_abs=812.3
    """
    if not pcm16_bytes:
        print("[mulaw debug] empty buffer — no samples to inspect")
        return
    arr = np.frombuffer(pcm16_bytes, dtype=np.int16).astype(np.float32)
    print(
        f"[mulaw debug] samples={len(arr)} "
        f"min={arr.min():.0f} "
        f"max={arr.max():.0f} "
        f"mean_abs={np.abs(arr).mean():.1f}"
    )
