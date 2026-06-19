import { useRef, useCallback } from 'react';

export default function useSound() {
  const audioContextRef = useRef(null);
  const getAudioContext = () => {
    if (!audioContextRef.current)
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioContextRef.current;
  };

  const playBeep = useCallback(() => {
    const context = getAudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain); gain.connect(context.destination);
    osc.frequency.value = 800; osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.08);
    osc.start(context.currentTime); osc.stop(context.currentTime + 0.08);
  }, []);

  const playErrorBeep = useCallback(() => {
    const context = getAudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain); gain.connect(context.destination);
    osc.frequency.value = 200; osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
    osc.start(context.currentTime); osc.stop(context.currentTime + 0.3);
  }, []);

  return { playBeep, playErrorBeep };
}
