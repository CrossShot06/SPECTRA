/**
 * pcm-processor.js — AudioWorklet for downsampling mic input to 16kHz signed-int16 PCM.
 * Buffers exactly 8000 samples (500ms @ 16kHz) then posts the Int16Array buffer.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(8000);
    this.writeIndex = 0;
    this.inputSampleRate = sampleRate; // inherited from AudioWorkletGlobalScope
    this.downsampleRatio = this.inputSampleRate / 16000;
    this.fractionalIndex = 0;
  }

  floatToInt16(sample) {
    const clamped = Math.max(-1, Math.min(1, sample));
    return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono channel

    for (let i = 0; i < channelData.length; i++) {
      this.fractionalIndex += 1;
      if (this.fractionalIndex >= this.downsampleRatio) {
        this.fractionalIndex -= this.downsampleRatio;
        this.buffer[this.writeIndex] = this.floatToInt16(channelData[i]);
        this.writeIndex++;

        if (this.writeIndex >= 8000) {
          // Post the complete 500ms chunk
          this.port.postMessage({
            type: 'pcm-chunk',
            buffer: this.buffer.buffer.slice(0),
          });
          this.buffer = new Int16Array(8000);
          this.writeIndex = 0;
        }
      }
    }

    // Also forward raw float samples for oscilloscope visualization
    this.port.postMessage({
      type: 'waveform',
      samples: new Float32Array(channelData),
    });

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
