import os
import json
import torch
import torchaudio
import soundfile as sf
import numpy as np
from models.AASIST import Model

def load_real_model():
    # 1. Load the model configuration
    with open("config/AASIST-L.conf", "r") as f:
        config = json.load(f)
    
    # 2. Initialize the real model architecture
    device = torch.device("cpu")
    model = Model(config["model_config"]).to(device)
    
    # 3. Load the pre-trained weights
    model.load_state_dict(torch.load("AASIST-L.pth", map_location=device))
    model.eval()
    return model, device

def check_audio(model, device, file_path):
    print(f"\nAnalyzing: {file_path}")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    # Load audio directly using soundfile to bypass torchcodec
    data, sample_rate = sf.read(file_path, dtype="float32")
    
    # Convert numpy array to PyTorch tensor with shape [channels, samples]
    if data.ndim == 1:
        waveform = torch.from_numpy(data).unsqueeze(0)  # mono -> [1, samples]
    else:
        waveform = torch.from_numpy(data.T)            # multi-channel -> [channels, samples]
    
    # Resample to 16kHz if needed
    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
        waveform = resampler(waveform)
    
    # Convert stereo to mono
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    
    # Pad or truncate to ~4 seconds (64600 samples)
    target_length = 64600
    if waveform.shape[1] > target_length:
        waveform = waveform[:, :target_length]
    else:
        pad_amount = target_length - waveform.shape[1]
        waveform = torch.nn.functional.pad(waveform, (0, pad_amount))
        
    # Run Inference
    with torch.no_grad():
        waveform = waveform.to(device) 
        _, output = model(waveform)
        
        # Output format: [Genuine, Spoofed]
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
    
    check_audio(model, device, "../genuine.wav")
    check_audio(model, device, "../spoofed.wav")