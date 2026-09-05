import numpy as np
import onnxruntime as ort
from scipy.signal import resample_poly
from math import gcd

class VoiceIntegrityEngine:
    _instance = None

    def __init__(self, onnx_model_path="aasist_optimized.onnx"):
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 2
        sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.ort_session = ort.InferenceSession(
            onnx_model_path,
            sess_options,
            providers=['CPUExecutionProvider']
        )
        self.target_length = 64600
        self.target_sr = 16000
        self._input_name = self.ort_session.get_inputs()[0].name

        # Warm up so the first real request isn't paying setup cost
        dummy = np.zeros((1, self.target_length), dtype=np.float32)
        self.ort_session.run(None, {self._input_name: dummy})

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def resample_to_target(self, data: np.ndarray, orig_sr: int) -> np.ndarray:
        if orig_sr == self.target_sr:
            return data
        g = gcd(orig_sr, self.target_sr)
        up, down = self.target_sr // g, orig_sr // g
        return resample_poly(data, up, down).astype(np.float32)

    def score_array(self, waveform_16k: np.ndarray) -> float:
        """Expects a 1D float32 array already at 16kHz, range [-1, 1]."""
        arr = np.expand_dims(waveform_16k, axis=0)
        length = arr.shape[1]
        if length > self.target_length:
            arr = arr[:, :self.target_length]
        elif length < self.target_length:
            arr = np.pad(arr, ((0, 0), (0, self.target_length - length)), mode='constant')

        output = self.ort_session.run(None, {self._input_name: arr})
        return float(output[0][0])

    def score_pcm_bytes(self, raw_pcm: bytes, sample_rate: int = 16000) -> float:
        """Convenience path for standalone/test use — resamples internally."""
        data = np.frombuffer(raw_pcm, dtype=np.int16).astype(np.float32) / 32768.0
        data = self.resample_to_target(data, sample_rate)
        return self.score_array(data)