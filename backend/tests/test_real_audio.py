import os
import sys
import json
import torch
import torchaudio
import soundfile as sf
import numpy as np

# Point Python to the root directory so it can find the aasist architecture
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from aasist.models.AASIST import Model

def load_real_model():
    # Updated paths for the new production folder structure
    config_path = "../aasist/config/AASIST-L.conf"
    weights_path = "../aasist/AASIST-L.pth"
    
    with open(config_path, "r") as f:
        config = json.load(f)
    
    device = torch.device("cpu")
    model = Model(config["model_config"]).to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()
    return model, device

def check_audio(model, device, file_path):
    print(f"\nAnalyzing: {file_path}")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    data, sample_rate = sf.read(file_path, dtype="float32")
    
    if data.ndim == 1:
        waveform = torch.from_numpy(data).unsqueeze(0)
    else:
        waveform = torch.from_numpy(data.T)
    
    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
        waveform = resampler(waveform)
    
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    
    target_length = 64600
    if waveform.shape[1] > target_length:
        waveform = waveform[:, :target_length]
    else:
        pad_amount = target_length - waveform.shape[1]
        waveform = torch.nn.functional.pad(waveform, (0, pad_amount))
        
    with torch.no_grad():
        waveform = waveform.to(device) 
        _, output = model(waveform)
        
        probabilities = torch.nn.functional.softmax(output, dim=1)
        spoof_risk_score = probabilities[0][1].item()
        
    print(f"Risk Score: {spoof_risk_score * 100:.2f}%")
    if spoof_risk_score > 0.60:
        print("Verdict: 🚨 AI/CLONED VOICE DETECTED")
    else:
        print("Verdict: ✅ GENUINE HUMAN VOICE")

if __name__ == "__main__":
    print("Loading Pre-Trained AASIST-L Engine...")
    model, device = load_real_model()
    print("Engine Ready.")
    
    # Audio files are now in the same 'tests' directory as this script

    check_audio(model, device, "genuine.wav")
    check_audio(model, device, "spoofed.wav")