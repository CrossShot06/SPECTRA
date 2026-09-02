import torch
import onnx
import onnxruntime as ort
import numpy as np
from baseline_inference import AASIST_L

def export_to_onnx():
    print("Loading PyTorch model into memory...")
    model = AASIST_L()
    model.eval()

    # Dummy tensor matching the 16kHz, ~4s audio frame
    dummy_input = torch.randn(1, 64600)
    onnx_path = "aasist_l_quantized.onnx"

    print("Exporting model to ONNX format...")
    torch.onnx.export(
        model, 
        dummy_input, 
        onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['audio_input'],
        output_names=['risk_logits'],
        dynamic_axes={'audio_input': {0: 'batch_size'}, 'risk_logits': {0: 'batch_size'}}
    )
    print(f"Export Complete: {onnx_path} generated successfully.")

def test_onnx_runtime():
    # Initialize the Windows ONNX Runtime session
    ort_session = ort.InferenceSession("aasist_l_quantized.onnx")
    
    # Generate dummy float32 audio data to simulate a live packet
    dummy_audio = np.random.randn(1, 64600).astype(np.float32)
    
    # Run the ultra-fast inference
    inputs = {ort_session.get_inputs()[0].name: dummy_audio}
    logits = ort_session.run(None, inputs)[0]
    
    exp_logits = np.exp(logits - np.max(logits))
    probabilities = exp_logits / exp_logits.sum(axis=1, keepdims=True)
    
    print(f"ONNX CPU Optimization Test - Risk Score: {probabilities[0][1]:.4f}")

if __name__ == "__main__":
    export_to_onnx()
    test_onnx_runtime()