import { useRef, useEffect, useCallback } from 'react';

/**
 * Waveform — High-framerate Canvas oscilloscope visualizer.
 * Renders raw Float32 audio samples as a crisp emerald waveform against a dark grid.
 */
export default function Waveform({ samples, isActive, riskScore = 0 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const samplesRef = useRef(samples);
  samplesRef.current = samples;

  // Determine waveform color based on risk
  const getStrokeColor = useCallback(() => {
    if (riskScore >= 0.6) return '#ef4444';   // crimson
    if (riskScore >= 0.3) return '#f59e0b';   // amber
    return '#10b981';                           // emerald
  }, [riskScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const data = samplesRef.current;

      // Clear
      ctx.fillStyle = '#06080e';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(27, 36, 54, 0.5)';
      ctx.lineWidth = 0.5;
      const gridSpacing = 20;
      for (let y = gridSpacing; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = gridSpacing; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Waveform
      if (data && data.length > 0 && isActive) {
        ctx.strokeStyle = getStrokeColor();
        ctx.lineWidth = 1.5;
        ctx.shadowColor = getStrokeColor();
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const step = data.length / w;
        for (let i = 0; i < w; i++) {
          const idx = Math.floor(i * step);
          const sample = data[idx] || 0;
          const y = (1 - sample) * h / 2;

          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Idle flat line
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [isActive, getStrokeColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-md"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
