import { useCallback, useRef } from 'react';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const SUB_LABELS = {
  '1': '',
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '*': '',
  '0': '+',
  '#': '',
};

// Simple DTMF tone generation for tactile feedback
const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

function playDTMF(key) {
  try {
    const ctx = new AudioContext();
    const [f1, f2] = DTMF_FREQS[key] || [0, 0];
    const duration = 0.08;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.value = f1;
    osc2.frequency.value = f2;
    gain.gain.value = 0.06;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);

    setTimeout(() => ctx.close(), 200);
  } catch {
    // Silently fail if AudioContext unavailable
  }
}

/**
 * Keypad — VoIP-style numeric dialpad with DTMF feedback.
 */
export default function Keypad({ onDigit }) {
  const handlePress = useCallback(
    (key) => {
      playDTMF(key);
      onDigit?.(key);
    },
    [onDigit]
  );

  return (
    <div className="grid grid-cols-3 gap-3 px-6">
      {KEYS.flat().map((key) => (
        <button
          key={key}
          onClick={() => handlePress(key)}
          className="keypad-btn flex flex-col items-center justify-center h-[56px] rounded-lg bg-spectra-card border border-spectra-border hover:border-spectra-border-bright transition-colors cursor-pointer"
        >
          <span className="text-lg font-semibold text-white/90 leading-none">
            {key}
          </span>
          {SUB_LABELS[key] && (
            <span className="text-[9px] font-medium tracking-[0.15em] text-spectra-slate mt-0.5">
              {SUB_LABELS[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
