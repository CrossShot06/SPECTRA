import json
import torch
import torch.nn as nn
import warnings
from aasist.models.AASIST import Model

# Suppress PyTorch's internal dynamo warnings for cleaner output
warnings.filterwarnings("ignore")

class AASISTONNXWrapper(nn.Module):
    def __init__(self, original_model):
        super().__init__()
        self.model = original_model
        
    def forward(self, x):
        _, logits = self.model(x)
        probs = torch.nn.functional.softmax(logits, dim=1)
        # Index 0 is the synthetic/spoofed probability
        return probs[:, 1]

print("Loading AASIST PyTorch weights...")
with open("aasist/config/AASIST-L.conf") as f:
    config = json.load(f)

device = torch.device("cpu")
pytorch_model = Model(config["model_config"]).to(device)
pytorch_model.load_state_dict(torch.load("aasist/AASIST-L.pth", map_location=device))

# Initialize wrapper and force evaluation mode to prevent Dropout layers from skewing data
wrapped_model = AASISTONNXWrapper(pytorch_model)
wrapped_model.eval()

# Dummy input matching AASIST-L's expected temporal dimension
dummy_input = torch.randn(1, 64600)

print("Exporting wrapped model to aasist_optimized.onnx...")
with torch.inference_mode():
    torch.onnx.export(
        wrapped_model,
        dummy_input,
        "aasist_optimized.onnx",
        export_params=True,
        opset_version=18,  # Forces compatibility with your PyTorch installation
        do_constant_folding=True,
        input_names=['audio_input'],
        output_names=['synthetic_probability']
        # Removed dynamic_axes to prevent Dynamo compilation crashes
    )
print("Export complete: aasist_optimized.onnx")