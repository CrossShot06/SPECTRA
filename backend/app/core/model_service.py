import io, json
import torch
import torchaudio
import numpy as np
import soundfile as sf
from aasist.models.AASIST import Model

class VoiceIntegrityEngine:
    _instance = None

    def __init__(self, config_path="aasist/config/AASIST-L.conf", weights_path="aasist/AASIST-L.pth"):
        with open(config_path) as f:
            config = json.load(f)
        self.device = torch.device("cpu")
        self.model = Model(config["model_config"]).to(self.device)
        self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        self.model.eval()
        self.target_length = 64600

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _run_inference(self, waveform: torch.Tensor) -> float:
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        if waveform.shape[1] > self.target_length:
            waveform = waveform[:, :self.target_length]
        else:
            waveform = torch.nn.functional.pad(waveform, (0, self.target_length - waveform.shape[1]))
        with torch.no_grad():
            _, output = self.model(waveform.to(self.device))
            probs = torch.nn.functional.softmax(output, dim=1)
            return probs[0][1].item()

    def score_bytes(self, raw_audio: bytes, sample_rate: int = 16000) -> float:
        data, sr = sf.read(io.BytesIO(raw_audio), dtype="float32")
        waveform = torch.from_numpy(data).unsqueeze(0) if data.ndim == 1 else torch.from_numpy(data.T)
        if sr != 16000:
            waveform = torchaudio.transforms.Resample(sr, 16000)(waveform)
        return self._run_inference(waveform)

    def score_pcm_bytes(self, raw_pcm: bytes, sample_rate: int = 16000) -> float:
        data = np.frombuffer(raw_pcm, dtype=np.int16).astype(np.float32) / 32768.0
        waveform = torch.from_numpy(data).unsqueeze(0)
        return self._run_inference(waveform)